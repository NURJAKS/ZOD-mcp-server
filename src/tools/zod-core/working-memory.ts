import { createClient } from 'redis'
import { Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadZodCoreConfig } from './config'

export interface WorkingState {
  sessionId: string
  lastUpdated: number
  state: Record<string, any>
}

export interface WorkingMemoryProvider {
  get(sessionId: string): Promise<WorkingState | null>
  set(sessionId: string, state: Record<string, any>): Promise<void>
  patch(sessionId: string, partial: Record<string, any>): Promise<void>
}

class RedisWorkingMemory implements WorkingMemoryProvider {
  private client = createClient({ url: process.env.REDIS_URL })
  private ttl: number

  constructor(ttlSeconds: number) {
    this.ttl = ttlSeconds
    this.client.on('error', () => {})
  }

  private async ensure(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect()
  }

  async get(sessionId: string): Promise<WorkingState | null> {
    await this.ensure()
    const raw = await this.client.get(`zodcore:wm:${sessionId}`)
    return raw ? JSON.parse(raw) : null
  }

  async set(sessionId: string, state: Record<string, any>): Promise<void> {
    await this.ensure()
    const ws: WorkingState = { sessionId, lastUpdated: Date.now(), state }
    await this.client.set(`zodcore:wm:${sessionId}`, JSON.stringify(ws), { EX: this.ttl })
  }

  async patch(sessionId: string, partial: Record<string, any>): Promise<void> {
    const current = (await this.get(sessionId))?.state || {}
    await this.set(sessionId, { ...current, ...partial })
  }
}

class SqliteWorkingMemory implements WorkingMemoryProvider {
  private db!: Database
  private ttl: number
  private initialized = false
  private path: string

  constructor(ttlSeconds: number) {
    this.ttl = ttlSeconds
    this.path = process.env.SQLITE_PATH || join(tmpdir(), 'zodcore_wm.sqlite')
  }

  private async ensure(): Promise<void> {
    if (this.initialized) return
    this.db = await open({ filename: this.path, driver: sqlite3.Database })
    await this.db.exec(
      'CREATE TABLE IF NOT EXISTS working_memory (session_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'
    )
    this.initialized = true
  }

  async get(sessionId: string): Promise<WorkingState | null> {
    await this.ensure()
    const row = await this.db.get('SELECT payload, updated_at FROM working_memory WHERE session_id = ?', sessionId)
    if (!row) return null
    const expired = Date.now() - row.updated_at > this.ttl * 1000
    if (expired) return null
    const ws = JSON.parse(row.payload)
    return ws
  }

  async set(sessionId: string, state: Record<string, any>): Promise<void> {
    await this.ensure()
    const ws: WorkingState = { sessionId, lastUpdated: Date.now(), state }
    await this.db.run(
      'INSERT INTO working_memory(session_id, payload, updated_at) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at',
      sessionId,
      JSON.stringify(ws),
      ws.lastUpdated,
    )
  }

  async patch(sessionId: string, partial: Record<string, any>): Promise<void> {
    const current = (await this.get(sessionId))?.state || {}
    await this.set(sessionId, { ...current, ...partial })
  }
}

class MemoryWorkingMemory implements WorkingMemoryProvider {
  private ttl: number
  private store = new Map<string, WorkingState>()

  constructor(ttlSeconds: number) { this.ttl = ttlSeconds }

  async get(sessionId: string): Promise<WorkingState | null> {
    const ws = this.store.get(sessionId)
    if (!ws) return null
    if (Date.now() - ws.lastUpdated > this.ttl * 1000) return null
    return ws
  }
  async set(sessionId: string, state: Record<string, any>): Promise<void> {
    this.store.set(sessionId, { sessionId, state, lastUpdated: Date.now() })
  }
  async patch(sessionId: string, partial: Record<string, any>): Promise<void> {
    const current = (await this.get(sessionId))?.state || {}
    await this.set(sessionId, { ...current, ...partial })
  }
}

export function createWorkingMemory(): WorkingMemoryProvider {
  const cfg = loadZodCoreConfig()
  if (cfg.workingMemory.provider === 'redis' && process.env.REDIS_URL) return new RedisWorkingMemory(cfg.workingMemory.ttlSeconds)
  if (cfg.workingMemory.provider === 'sqlite') return new SqliteWorkingMemory(cfg.workingMemory.ttlSeconds)
  return new MemoryWorkingMemory(cfg.workingMemory.ttlSeconds)
}


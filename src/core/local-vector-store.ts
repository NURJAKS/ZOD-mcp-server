import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { safeLog } from '../utils'

export interface LocalVectorPoint {
  id: string
  vector: number[]
  payload: Record<string, any>
}

export interface LocalVectorSearchOptions {
  limit?: number
  scoreThreshold?: number
  filter?: { key: string; any?: string[]; value?: string }[]
}

export class LocalVectorStore {
  private db!: Database
  private initialized = false
  private path: string

  constructor(dbPath?: string) {
    this.path = dbPath || join(tmpdir(), 'zodcore_vectors.sqlite')
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.db = await open({ filename: this.path, driver: sqlite3.Database })
    await this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        dim INTEGER NOT NULL
      );
    `)
    this.initialized = true
  }

  private async ensureCollection(name: string, dim: number): Promise<void> {
    await this.initialize()
    const row = await this.db.get('SELECT dim FROM collections WHERE name = ?', name) as { dim?: number } | undefined
    if (!row) {
      await this.db.run('INSERT INTO collections(name, dim) VALUES(?, ?)', name, dim)
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS points_${name} (
          id TEXT PRIMARY KEY,
          vector TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_${name}_payload_repository ON points_${name} (json_extract(payload, '$.repository'));
        CREATE INDEX IF NOT EXISTS idx_${name}_payload_language ON points_${name} (json_extract(payload, '$.language'));
        CREATE INDEX IF NOT EXISTS idx_${name}_payload_doc ON points_${name} (json_extract(payload, '$.documentation'));
      `)
      safeLog(`LocalVectorStore: created collection ${name} (dim=${dim})`)
    } else if (row.dim !== dim) {
      // Dimension mismatch is fatal for cosine distance; recreate collection
      await this.db.run('UPDATE collections SET dim = ? WHERE name = ?', dim, name)
      await this.db.exec(`DROP TABLE IF EXISTS points_${name};`)
      await this.db.exec(`
        CREATE TABLE points_${name} (
          id TEXT PRIMARY KEY,
          vector TEXT NOT NULL,
          payload TEXT NOT NULL
        );
      `)
      safeLog(`LocalVectorStore: reset collection ${name} to dim=${dim}`, 'warn')
    }
  }

  async upsert(collection: string, point: LocalVectorPoint, dim: number): Promise<void> {
    await this.ensureCollection(collection, dim)
    await this.db.run(
      `INSERT INTO points_${collection}(id, vector, payload) VALUES(?,?,?)
       ON CONFLICT(id) DO UPDATE SET vector=excluded.vector, payload=excluded.payload`,
      point.id,
      JSON.stringify(point.vector),
      JSON.stringify(point.payload),
    )
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    await this.initialize()
    const placeholders = ids.map(() => '?').join(',')
    await this.db.run(`DELETE FROM points_${collection} WHERE id IN (${placeholders})`, ids)
  }

  async search(collection: string, queryVector: number[], options: LocalVectorSearchOptions & { dim: number }): Promise<Array<{ id: string; score: number; payload: any }>> {
    await this.ensureCollection(collection, options.dim)
    // Load candidates (filtering will be applied in JS for simplicity and correctness)
    const rows = await this.db.all(`SELECT id, vector, payload FROM points_${collection}`)
    const candidates = rows.map((r: any) => ({ id: r.id, vector: JSON.parse(r.vector) as number[], payload: JSON.parse(r.payload) }))

    // Apply simple filter pre-checks
    const filtered = candidates.filter(c => {
      if (!options.filter || options.filter.length === 0) return true
      return options.filter.every(f => {
        const val = c.payload[f.key]
        if (f.any) return Array.isArray(f.any) ? f.any.includes(val) : false
        if (typeof f.value !== 'undefined') return val === f.value
        return true
      })
    })

    // Compute cosine similarity
    const qNorm = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0)) || 1
    const scored = filtered.map(c => {
      const v = c.vector
      const dot = v.reduce((s, vi, i) => s + vi * (queryVector[i] || 0), 0)
      const vNorm = Math.sqrt(v.reduce((s, vi) => s + vi * vi, 0)) || 1
      const cosine = dot / (qNorm * vNorm)
      return { id: c.id, score: cosine, payload: c.payload }
    })
      .filter(r => typeof options.scoreThreshold === 'number' ? r.score >= options.scoreThreshold : true)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, options.limit || 20)
  }

  async getStats(collection: string): Promise<{ points: number }> {
    await this.initialize()
    const row = await this.db.get(`SELECT COUNT(*) as cnt FROM points_${collection}`) as { cnt: number }
    return { points: row?.cnt || 0 }
  }
}


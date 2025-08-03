import { createClient, RedisClientType } from 'redis'
import { safeLog } from '../utils'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
}

export class CacheService {
  private client: RedisClientType | null = null
  private isInitialized = false
  private prefix: string = 'nia:'

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      const password = process.env.REDIS_PASSWORD

      this.client = createClient({
        url: redisUrl,
        password: password || undefined,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      })

      this.client.on('error', (err) => {
        safeLog(`Redis Client Error: ${err}`, 'error')
      })

      this.client.on('connect', () => {
        safeLog('✅ Redis cache connected')
        this.isInitialized = true
      })

      await this.client.connect()
    } catch (error) {
      safeLog(`⚠️ Redis connection failed: ${error}`, 'warn')
      this.client = null
    }
  }

  public get isReady(): boolean {
    return this.isInitialized && this.client !== null
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.client) {
      safeLog('Redis not available, skipping cache set', 'warn')
      return
    }

    try {
      const fullKey = `${this.prefix}${key}`
      const ttl = options.ttl || 3600 // Default 1 hour
      
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
      }

      await this.client.setEx(fullKey, ttl, JSON.stringify(entry))
    } catch (error) {
      safeLog(`Cache set error: ${error}`, 'error')
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null
    }

    try {
      const fullKey = `${this.prefix}${key}`
      const value = await this.client.get(fullKey)
      
      if (!value) return null

      const entry: CacheEntry<T> = JSON.parse(value)
      const now = Date.now()
      
      // Check if expired
      if (now - entry.timestamp > entry.ttl * 1000) {
        await this.delete(key)
        return null
      }

      return entry.data
    } catch (error) {
      safeLog(`Cache get error: ${error}`, 'error')
      return null
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return

    try {
      const fullKey = `${this.prefix}${key}`
      await this.client.del(fullKey)
    } catch (error) {
      safeLog(`Cache delete error: ${error}`, 'error')
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return

    try {
      const keys = await this.client.keys(`${this.prefix}*`)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch (error) {
      safeLog(`Cache clear error: ${error}`, 'error')
    }
  }

  async getStats(): Promise<{
    keys: number
    memory: string
    connected: boolean
  }> {
    if (!this.client) {
      return { keys: 0, memory: '0B', connected: false }
    }

    try {
      const keys = await this.client.keys(`${this.prefix}*`)
      const info = await this.client.info('memory')
      
      // Parse memory info
      const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || '0B'
      
      return {
        keys: keys.length,
        memory: usedMemory,
        connected: true,
      }
    } catch (error) {
      safeLog(`Cache stats error: ${error}`, 'error')
      return { keys: 0, memory: '0B', connected: false }
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.isInitialized = false
    }
  }
}

// Global cache instance
export const cacheService = new CacheService() 
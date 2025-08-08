import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'
import { config } from 'dotenv'

// Environment variable schemas for type safety
export const GitHubConfigSchema = z.object({
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_RATE_LIMIT: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).default(5000),
})

export const OpenRouterConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_RATE_LIMIT: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).default(100),
})

export const QdrantConfigSchema = z.object({
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),
})

export const RedisConfigSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
})

export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().default('sqlite://./data/nia.db'),
})

export const WebSearchConfigSchema = z.object({
  SERPER_API_KEY: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),
})

export const IndexingConfigSchema = z.object({
  MAX_FILE_SIZE: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).default(1024000),
  MAX_REPOSITORY_SIZE: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).default(100000000),
  INDEXING_TIMEOUT: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).default(300000),
})

// Main environment configuration schema
export const EnvConfigSchema = z.object({
  github: GitHubConfigSchema,
  openrouter: OpenRouterConfigSchema,
  qdrant: QdrantConfigSchema,
  redis: RedisConfigSchema,
  database: DatabaseConfigSchema,
  webSearch: WebSearchConfigSchema,
  indexing: IndexingConfigSchema,
})

export type EnvConfig = z.infer<typeof EnvConfigSchema>

// Environment manager for loading and managing tokens
export class EnvManager {
  private config: EnvConfig
  private envFiles: string[] = []
  private loaded: boolean = false

  constructor() {
    this.config = this.getDefaultConfig()
  }

  // Load environment variables from .env files
  async loadEnvFiles(envPaths: string[] = []): Promise<void> {
    if (this.loaded) return

    // Default env file paths to check
    const defaultPaths = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
    ]

    const pathsToCheck = [...new Set([...defaultPaths, ...envPaths])]
    
    for (const envPath of pathsToCheck) {
      try {
        const fullPath = path.resolve(process.cwd(), envPath)
        const exists = await fs.access(fullPath).then(() => true).catch(() => false)
        
        if (exists) {
          config({ path: fullPath })
          this.envFiles.push(fullPath)
          console.log(`📁 Loaded environment from: ${envPath}`)
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${envPath}:`, error)
      }
    }

    // Parse environment variables into config
    this.config = this.parseEnvToConfig()
    this.loaded = true

    console.log(`✅ Environment loaded from ${this.envFiles.length} file(s)`)
  }

  // Parse environment variables into typed config
  private parseEnvToConfig(): EnvConfig {
    const env = process.env

    return EnvConfigSchema.parse({
      github: {
        GITHUB_TOKEN: env.GITHUB_TOKEN,
        GITHUB_RATE_LIMIT: env.GITHUB_RATE_LIMIT || '5000',
      },
      openrouter: {
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        OPENROUTER_RATE_LIMIT: env.OPENROUTER_RATE_LIMIT || '100',
      },
      qdrant: {
        QDRANT_URL: env.QDRANT_URL || 'http://localhost:6333',
        QDRANT_API_KEY: env.QDRANT_API_KEY,
      },
      redis: {
        REDIS_URL: env.REDIS_URL || 'redis://localhost:6379',
      },
      database: {
        DATABASE_URL: env.DATABASE_URL || 'sqlite://./data/nia.db',
      },
      webSearch: {
        SERPER_API_KEY: env.SERPER_API_KEY,
        SERPAPI_KEY: env.SERPAPI_KEY,
      },
      indexing: {
        MAX_FILE_SIZE: env.MAX_FILE_SIZE || '1024000',
        MAX_REPOSITORY_SIZE: env.MAX_REPOSITORY_SIZE || '100000000',
        INDEXING_TIMEOUT: env.INDEXING_TIMEOUT || '300000',
      },
    })
  }

  // Get configuration value
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key]
  }

  // Get specific token or API key
  getToken(service: 'github' | 'openrouter' | 'qdrant' | 'serper' | 'serpapi'): string | undefined {
    switch (service) {
      case 'github':
        return this.config.github.GITHUB_TOKEN
      case 'openrouter':
        return this.config.openrouter.OPENROUTER_API_KEY
      case 'qdrant':
        return this.config.qdrant.QDRANT_API_KEY
      case 'serper':
        return this.config.webSearch.SERPER_API_KEY
      case 'serpapi':
        return this.config.webSearch.SERPAPI_KEY
      default:
        return undefined
    }
  }

  // Get URL for a service
  getUrl(service: 'qdrant' | 'redis' | 'database'): string {
    switch (service) {
      case 'qdrant':
        return this.config.qdrant.QDRANT_URL
      case 'redis':
        return this.config.redis.REDIS_URL
      case 'database':
        return this.config.database.DATABASE_URL
      default:
        throw new Error(`Unknown service: ${service}`)
    }
  }

  // Get rate limit for a service
  getRateLimit(service: 'github' | 'openrouter'): number {
    switch (service) {
      case 'github':
        return this.config.github.GITHUB_RATE_LIMIT
      case 'openrouter':
        return this.config.openrouter.OPENROUTER_RATE_LIMIT
      default:
        throw new Error(`Unknown service: ${service}`)
    }
  }

  // Get indexing configuration
  getIndexingConfig() {
    return this.config.indexing
  }

  // Check if a token is available
  hasToken(service: 'github' | 'openrouter' | 'qdrant' | 'serper' | 'serpapi'): boolean {
    return !!this.getToken(service)
  }

  // Validate that required tokens are present
  validateRequiredTokens(requiredServices: Array<'github' | 'openrouter' | 'qdrant' | 'serper' | 'serpapi'>): string[] {
    const missing: string[] = []
    
    for (const service of requiredServices) {
      if (!this.hasToken(service)) {
        missing.push(service)
      }
    }
    
    return missing
  }

  // Get all loaded environment files
  getLoadedFiles(): string[] {
    return [...this.envFiles]
  }

  // Reload environment files
  async reload(): Promise<void> {
    this.loaded = false
    this.envFiles = []
    await this.loadEnvFiles()
  }

  private getDefaultConfig(): EnvConfig {
    return EnvConfigSchema.parse({
      github: {
        GITHUB_TOKEN: undefined,
        GITHUB_RATE_LIMIT: 5000,
      },
      openrouter: {
        OPENROUTER_API_KEY: undefined,
        OPENROUTER_RATE_LIMIT: 100,
      },
      qdrant: {
        QDRANT_URL: 'http://localhost:6333',
        QDRANT_API_KEY: undefined,
      },
      redis: {
        REDIS_URL: 'redis://localhost:6379',
      },
      database: {
        DATABASE_URL: 'sqlite://./data/nia.db',
      },
      webSearch: {
        SERPER_API_KEY: undefined,
        SERPAPI_KEY: undefined,
      },
      indexing: {
        MAX_FILE_SIZE: 1024000,
        MAX_REPOSITORY_SIZE: 100000000,
        INDEXING_TIMEOUT: 300000,
      },
    })
  }
}

// Global environment manager instance
export const envManager = new EnvManager()

// Helper function to get environment manager with loaded config
export async function getEnvManager(): Promise<EnvManager> {
  if (!envManager.loaded) {
    await envManager.loadEnvFiles()
  }
  return envManager
} 
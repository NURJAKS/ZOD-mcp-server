import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

// Configuration schemas for type safety
export const DatabaseConfigSchema = z.object({
  url: z.string().optional(),
  type: z.enum(['redis', 'postgres', 'sqlite']).default('redis'),
  poolSize: z.number().min(1).max(50).default(10),
})

export const SearchConfigSchema = z.object({
  vectorEngine: z.enum(['qdrant', 'pinecone', 'weaviate']).default('qdrant'),
  embeddingModel: z.string().default('text-embedding-ada-002'),
  maxResults: z.number().min(1).max(100).default(10),
})

export const PluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().min(1000).max(60000).default(30000),
  retries: z.number().min(0).max(5).default(3),
})

// Main configuration schema
export const AppConfigSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    mode: z.enum(['stdio', 'http', 'sse']).default('stdio'),
  }),
  database: DatabaseConfigSchema,
  search: SearchConfigSchema,
  plugins: z.record(z.string(), PluginConfigSchema).default({}),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('text'),
  }),
  features: z.object({
    enableFleet: z.boolean().default(true),
    enableDeepSearch: z.boolean().default(true),
    enableSmartAI: z.boolean().default(true),
  }),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

// Configuration manager with hot reloading
export class ConfigManager {
  private config: AppConfig
  private configPath: string
  private watchers: Set<(config: AppConfig) => void> = new Set()

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config.json')
    this.config = this.getDefaultConfig()
  }

  // Load configuration from file
  async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8')
      const parsedConfig = JSON.parse(configData)
      this.config = AppConfigSchema.parse(parsedConfig)
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults:`, error)
      this.config = this.getDefaultConfig()
    }
  }

  // Save configuration to file
  async saveConfig(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  // Get configuration value
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key]
  }

  // Set configuration value
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value
    this.notifyWatchers()
  }

  // Update configuration partially
  update(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates }
    this.notifyWatchers()
  }

  // Subscribe to configuration changes
  subscribe(callback: (config: AppConfig) => void): () => void {
    this.watchers.add(callback)
    return () => this.watchers.delete(callback)
  }

  // Get environment-specific configuration
  getEnvironmentConfig(env: string): Partial<AppConfig> {
    const envConfigs: Record<string, Partial<AppConfig>> = {
      development: {
        logging: { level: 'debug' },
        features: { enableFleet: true, enableDeepSearch: true, enableSmartAI: true },
      },
      production: {
        logging: { level: 'warn' },
        features: { enableFleet: false, enableDeepSearch: true, enableSmartAI: false },
      },
      test: {
        logging: { level: 'error' },
        features: { enableFleet: false, enableDeepSearch: false, enableSmartAI: false },
      },
    }
    return envConfigs[env] || {}
  }

  // Validate configuration
  validate(): boolean {
    try {
      AppConfigSchema.parse(this.config)
      return true
    } catch (error) {
      console.error('Configuration validation failed:', error)
      return false
    }
  }

  private getDefaultConfig(): AppConfig {
    return AppConfigSchema.parse({
      server: {
        port: 3000,
        host: 'localhost',
        mode: 'stdio',
      },
      database: {
        type: 'redis',
        poolSize: 10,
      },
      search: {
        vectorEngine: 'qdrant',
        embeddingModel: 'text-embedding-ada-002',
        maxResults: 10,
      },
      plugins: {},
      logging: {
        level: 'info',
        format: 'text',
      },
      features: {
        enableFleet: true,
        enableDeepSearch: true,
        enableSmartAI: true,
      },
    })
  }

  private notifyWatchers(): void {
    this.watchers.forEach(watcher => watcher(this.config))
  }
}

// Global configuration instance
export const configManager = new ConfigManager() 
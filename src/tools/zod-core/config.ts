import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ZodCoreConfig {
  models: {
    reasoningModel: string
    embeddingModel?: string
    embeddingModelHint?: string
  }
  memory: {
    vectorBackend: 'qdrant' | 'local'
    qdrant?: {
      url: string
      apiKey?: string
    }
    maxResults: number
    scoreThreshold: number
  }
  workingMemory: {
    provider: 'redis' | 'sqlite' | 'memory'
    ttlSeconds: number
  }
  tools: {
    visualizer: boolean
    repository: boolean
    documentation: boolean
    webDeepResearch: boolean
    projectInit: boolean
    multiAgent: boolean
  }
  chunking?: {
    maxTokens?: number
    overlap?: number
    strategy?: 'sliding' | 'ast'
  }
}

export function loadZodCoreConfig(projectPath?: string): ZodCoreConfig {
  const env = (key: string, def?: string) => process.env[key] ?? def

  // Optional per-project config file
  let fileConfig: Partial<ZodCoreConfig> = {}
  if (projectPath) {
    const configPath = join(projectPath, '.zodcore.json')
    if (existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(readFileSync(configPath, 'utf8'))
      } catch {
        // ignore malformed project config
      }
    }
  }

  const base: ZodCoreConfig = {
    models: {
      reasoningModel: env('OPENROUTER_REASONING_MODEL', 'openrouter/deepseek/deepseek-coder')!,
      embeddingModel: env('EMBEDDING_MODEL', 'openai/text-embedding-3-large'),
      embeddingModelHint: env('EMBEDDING_MODEL_HINT', 'openai/text-embedding-3-large'),
    },
    memory: {
      vectorBackend: env('QDRANT_URL') ? 'qdrant' : 'local',
      qdrant: env('QDRANT_URL') ? { url: env('QDRANT_URL', 'http://localhost:6333')!, apiKey: env('QDRANT_API_KEY') } : undefined,
      maxResults: Number(env('ZODCORE_MAX_RESULTS', '12')),
      scoreThreshold: Number(env('ZODCORE_SCORE_THRESHOLD', '0.55')),
    },
    workingMemory: {
      provider: env('REDIS_URL') ? 'redis' : env('SQLITE_PATH') ? 'sqlite' : 'memory',
      ttlSeconds: Number(env('ZODCORE_TTL_SECONDS', '1800')),
    },
    tools: {
      visualizer: env('ENABLE_VISUALIZER', 'true') === 'true',
      repository: env('ENABLE_REPOSITORY', 'true') === 'true',
      documentation: env('ENABLE_DOCUMENTATION', 'true') === 'true',
      webDeepResearch: env('ENABLE_WEB_RESEARCH', 'true') === 'true',
      projectInit: env('ENABLE_PROJECT_INIT', 'true') === 'true',
      multiAgent: env('ENABLE_MULTI_AGENT', 'true') === 'true',
    },
    chunking: {
      maxTokens: Number(env('ZODCORE_CHUNK_MAX_TOKENS', '800')),
      overlap: Number(env('ZODCORE_CHUNK_OVERLAP', '120')),
      strategy: (env('ZODCORE_CHUNK_STRATEGY', 'sliding') as 'sliding' | 'ast'),
    },
  }

  // shallow merge (env/base wins unless explicitly overridden)
  return {
    ...base,
    ...fileConfig,
    models: { ...base.models, ...(fileConfig.models || {}) },
    memory: { ...base.memory, ...(fileConfig.memory || {}) },
    workingMemory: { ...base.workingMemory, ...(fileConfig.workingMemory || {}) },
    tools: { ...base.tools, ...(fileConfig.tools || {}) },
    chunking: { ...base.chunking, ...(fileConfig as any).chunking },
  }
}


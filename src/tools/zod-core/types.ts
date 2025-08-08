import type { ToolResult } from '../../core/base-tool'

export type ZodIntent = 'analyze' | 'explain' | 'suggest' | 'plan' | 'reflect'

export interface ZodQuery {
  intent?: ZodIntent
  query: string
  area?: string
  targetPath?: string
  maxDepth?: number
}

export interface ZodContext {
  projectPath?: string
  sessionId: string
  toolPreferences?: {
    allowExternalSearch?: boolean
    allowVisualizer?: boolean
    allowInit?: boolean
    preferInternalAnalysis?: boolean
  }
  environment?: Record<string, string | undefined>
}

export type ZodResultKind = 'response' | 'strategy' | 'insight' | 'command'

export interface ZodResult {
  kind: ZodResultKind
  title?: string
  text: string
  data?: any
  steps?: Array<{ title: string; detail?: string }>
  usedTools?: string[]
  sessionId?: string
}

export interface MemoryHit {
  source: 'file' | 'doc'
  pathOrUrl: string
  title?: string
  language?: string
  score: number
  snippet: string
}

export interface OrchestratorResponse extends ZodResult {
  memoryHits?: MemoryHit[]
  workingState?: Record<string, any>
  trace?: string
}

export interface ZodCoreToolOutput extends ToolResult {
  metadata?: {
    sessionId?: string
    intent?: ZodIntent
    usedTools?: string[]
    memoryHits?: MemoryHit[]
    trace?: string
  }
}


import { VectorSearchEngine, type VectorSearchResult } from '../../core/vector-search'
import { ProjectAnalyzer } from '../../core/project-analyzer'
import { loadZodCoreConfig } from './config'
import { safeLog } from '../../utils'

export interface SemanticQueryOptions {
  limit?: number
  scoreThreshold?: number
}

export class SemanticMemory {
  private vector: VectorSearchEngine
  private analyzer: ProjectAnalyzer
  private initialized = false

  constructor() {
    this.vector = new VectorSearchEngine()
    this.analyzer = new ProjectAnalyzer()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await Promise.all([
      this.vector.initialize(),
      this.analyzer.initialize(),
    ])
    this.initialized = true
  }

  async ensureIndexedProject(projectPath: string, repoLabel = 'local'): Promise<void> {
    await this.initialize()
    // Lightweight indexing: collect file list and index content snippets as vectors
    const structure = await this.analyzer.analyzeProjectStructure(projectPath)
    const files = structure.files.filter(f => f.type !== 'binary')
    const fs = await import('node:fs/promises')
    for (const f of files) {
      try {
        const abs = require('node:path').join(projectPath, f.path)
        const content = await fs.readFile(abs, 'utf8')
        const lines = content.split(/\r?\n/).length
        await this.vector.indexFile(`${repoLabel}:${f.path}`, content.slice(0, 8000), {
          path: f.path,
          language: f.language || 'text',
          repository: repoLabel,
          size: f.size || content.length,
          lines,
        })
      } catch (e) {
        // skip unreadable
        continue
      }
    }
    safeLog(`SemanticMemory: indexed ${files.length} files from ${projectPath}`)
  }

  async searchProject(query: string, options: SemanticQueryOptions = {}): Promise<VectorSearchResult[]> {
    await this.initialize()
    const cfg = loadZodCoreConfig()
    return this.vector.searchFiles(query, {
      limit: options.limit ?? cfg.memory.maxResults,
      scoreThreshold: options.scoreThreshold ?? cfg.memory.scoreThreshold,
    })
  }
}


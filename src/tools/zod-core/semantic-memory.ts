import { VectorSearchEngine, type VectorSearchResult } from '../../core/vector-search'
import { ProjectAnalyzer } from '../../core/project-analyzer'
import { loadZodCoreConfig } from './config'
import { safeLog } from '../../utils'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import fs from 'node:fs/promises'

export interface SemanticQueryOptions {
  limit?: number
  scoreThreshold?: number
}

export class SemanticMemory {
  private vector: VectorSearchEngine
  private analyzer: ProjectAnalyzer
  private initialized = false
  private chunking = { maxTokens: 800, overlap: 120, strategy: 'sliding' as const }

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
    const cfg = loadZodCoreConfig(projectPath)
    this.chunking = {
      maxTokens: cfg.chunking?.maxTokens ?? 800,
      overlap: cfg.chunking?.overlap ?? 120,
      strategy: cfg.chunking?.strategy ?? 'sliding',
    }
    const structure = await this.analyzer.analyzeProjectStructure(projectPath)
    const files = structure.files.filter(f => f.type !== 'binary')
    let totalChunks = 0
    for (const f of files) {
      try {
        const abs = join(projectPath, f.path)
        const content = await fs.readFile(abs, 'utf8')
        const chunks = this.chunkFile(content, this.chunking.maxTokens, this.chunking.overlap)
        const linesIdx = this.prefixLineIndices(content)
        const language = f.language || 'text'
        const lines = content.split(/\r?\n/).length
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const chunkId = this.makeId(`${repoLabel}:${f.path}:${i}`)
          const meta = {
            path: f.path,
            language,
            repository: repoLabel,
            size: f.size || content.length,
            lines,
          }
          // derive line numbers
          const startChar = chunk.start
          const endChar = chunk.end
          const startLine = this.findLineAtOffset(linesIdx, startChar)
          const endLine = this.findLineAtOffset(linesIdx, endChar)
          await this.vector.indexFile(
            chunkId,
            chunk.text,
            meta,
            {
              chunkIndex: i,
              chunkCount: chunks.length,
              startLine,
              endLine,
            },
          )
          totalChunks++
        }
      } catch (e) {
        continue
      }
    }
    safeLog(`SemanticMemory: indexed ${files.length} files (${totalChunks} chunks) from ${projectPath}`)
  }

  async searchProject(query: string, options: SemanticQueryOptions = {}): Promise<VectorSearchResult[]> {
    await this.initialize()
    const cfg = loadZodCoreConfig()
    return this.vector.searchFiles(query, {
      limit: options.limit ?? cfg.memory.maxResults,
      scoreThreshold: options.scoreThreshold ?? cfg.memory.scoreThreshold,
    })
  }

  private chunkFile(text: string, maxTokens: number, overlap: number): Array<{ text: string; start: number; end: number }> {
    // Character-based approximation to token counts
    const approxCharsPerToken = 4
    const maxChars = maxTokens * approxCharsPerToken
    const overlapChars = overlap * approxCharsPerToken
    const chunks: Array<{ text: string; start: number; end: number }> = []
    let start = 0
    while (start < text.length) {
      const end = Math.min(text.length, start + maxChars)
      const slice = text.slice(start, end)
      chunks.push({ text: slice, start, end })
      if (end === text.length) break
      start = Math.max(0, end - overlapChars)
    }
    return chunks
  }

  private prefixLineIndices(text: string): number[] {
    const lines = text.split(/\r?\n/)
    const indices: number[] = []
    let acc = 0
    for (const line of lines) {
      indices.push(acc)
      acc += line.length + 1 // include newline
    }
    indices.push(acc)
    return indices
  }

  private findLineAtOffset(lineIndices: number[], offset: number): number {
    // binary search
    let lo = 0, hi = lineIndices.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2)
      if (lineIndices[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return Math.max(1, lo + 1)
  }

  private makeId(s: string): string {
    return createHash('sha1').update(s).digest('hex')
  }
}


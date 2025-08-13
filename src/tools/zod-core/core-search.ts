import { z } from 'zod'
import type { McpToolContext } from '../../types'
import { safeLog } from '../../utils'
import { Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'

export interface SearchResult {
  file: string
  line: number
  column?: number
  content: string
  match: string
  context: string
  score: number
  type: 'exact' | 'semantic' | 'structural'
  language?: string
}

export interface SearchOptions {
  query: string
  type?: 'exact' | 'semantic' | 'structural'
  file?: string
  language?: string
  limit?: number
  caseSensitive?: boolean
  fileTypes?: string[]
}

export class CoreSearcher {
  private db!: Database
  private initialized = false
  private dbPath: string

  constructor(dbPath?: string) {
    // Use the same database as core index tool
    this.dbPath = dbPath || join(tmpdir(), 'zodcore_index.sqlite')
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      // Handle database file issues
      await this.ensureValidDatabase()
      
      this.db = await open({ filename: this.dbPath, driver: sqlite3.Database })
      
      // Best-effort: create search_index if missing (with project_path) so ensureIndex can run
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_index (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_path TEXT,
          file_path TEXT NOT NULL,
          content_type TEXT NOT NULL,
          content TEXT NOT NULL,
          line_number INTEGER,
          relevance_score REAL DEFAULT 1.0,
          indexed_at INTEGER NOT NULL
        );
      `)
      
      // Create search history table (search_index table is created by core index tool)
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          results_count INTEGER NOT NULL,
          search_type TEXT NOT NULL,
          searched_at INTEGER NOT NULL
        );
      `)
      
      this.initialized = true
      safeLog(`CoreSearcher: initialized with database at ${this.dbPath}`)
    } catch (error) {
      safeLog(`Failed to initialize CoreSearcher: ${error}`, 'error')
      throw error
    }
  }

  private async ensureValidDatabase(): Promise<void> {
    try {
      // Check if database file exists and is valid
      const stats = await fs.stat(this.dbPath)
      if (stats.size === 0) {
        // Empty file, remove it
        await fs.unlink(this.dbPath)
        return
      }
      
      // Try to open and test the database
      const testDb = await open({ filename: this.dbPath, driver: sqlite3.Database })
      await testDb.get('SELECT 1')
      await testDb.close()
    } catch (error) {
      // Database is invalid or read-only, remove and recreate
      try {
        await fs.unlink(this.dbPath)
      } catch {
        // File doesn't exist or can't be deleted, that's fine
      }
    }
  }

  async ensureIndex(projectPath: string): Promise<void> {
    await this.initialize()
    const row = await this.db.get('SELECT COUNT(1) as cnt FROM search_index') as any
    if (!row || !row.cnt) {
      await this.buildSearchIndex(projectPath)
    }
  }

  async buildSearchIndex(projectPath: string, opts?: { includePatterns?: string[]; excludePatterns?: string[] }): Promise<{ success: boolean; filesIndexed: number }> {
    try {
      await this.initialize()
      
      // Clear existing index
      await this.db.run('DELETE FROM search_index')
      
      // Scan project directory (tests expect scanning created temp project)
      const { glob } = await import('glob')
      const include = opts?.includePatterns || ['**/*.js','**/*.ts','**/*.jsx','**/*.tsx','**/*.json']
      const ignore = opts?.excludePatterns || ['**/node_modules/**','**/dist/**','**/build/**','**/.git/**']
      const matched = new Set<string>()
      for (const pattern of include) {
        try {
          const picks = await glob(pattern, { cwd: projectPath, absolute: false, nodir: true, ignore })
          picks.forEach(p => matched.add(p))
        } catch {}
      }
      const files = Array.from(matched).map(path => ({ path, language: this.detectLanguage(path) }))
      
      let filesIndexed = 0
      
      for (const file of files) {
        try {
          const absPath = join(projectPath, file.path)
          const content = await fs.readFile(absPath, 'utf8')
          const lines = content.split('\n')
          
          // Index each line with basic classification
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const lineNumber = i + 1
            const contentType = line.trim().startsWith('//') || line.trim().startsWith('#') ? 'comment' : 'code'
            await this.db.run(
               'INSERT INTO search_index (project_path, file_path, content_type, content, line_number, indexed_at) VALUES (?, ?, ?, ?, ?, ?)',
              projectPath,
               file.path,
              contentType,
              line,
              lineNumber,
              Date.now()
            )
          }
          
          filesIndexed++
        } catch (error) {
          safeLog(`Failed to index ${file.path} for search: ${error}`, 'warn')
        }
      }
      
      safeLog(`CoreSearcher: indexed ${filesIndexed} files for search`)
      
      return { success: true, filesIndexed }
      
    } catch (error) {
      safeLog(`Search index build failed: ${error}`, 'error')
      return { success: false, filesIndexed: 0 }
    }
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    await this.initialize()
    const {
      query,
      type = 'exact',
      file,
      language,
      limit = 50,
      caseSensitive = false,
      fileTypes
    } = options

    const likeOp = caseSensitive ? 'LIKE' : 'LIKE'
    const pattern = caseSensitive ? `%${query}%` : `%${query.toLowerCase()}%`

    let sql = 'SELECT file_path as file, line_number as line, content FROM search_index WHERE 1=1'
    const params: any[] = []
    
    if (!caseSensitive) {
      sql += ' AND LOWER(content) LIKE ?'
      params.push(pattern)
    } else {
      sql += ' AND content LIKE ?'
      params.push(pattern)
    }

    if (file) {
      sql += ' AND file_path LIKE ?'
      params.push(`%${file}%`)
    }

    if (language) {
      // language is not stored; infer by extension
      sql += ' AND (file_path LIKE ? OR file_path LIKE ? OR file_path LIKE ? OR file_path LIKE ?)' // js, ts, jsx, tsx crude mapping
      switch (language.toLowerCase()) {
        case 'javascript':
          params.push('%.js%', '%.mjs%', '%.cjs%', '%.jsx%')
          break
        case 'typescript':
          params.push('%.ts%', '%.tsx%', '%.mts%', '%.cts%')
          break
        default:
          params.push(`%.${language}%`, `%.${language}%`, `%.${language}%`, `%.${language}%`)
      }
    }

    if (fileTypes && fileTypes.length > 0) {
      const ors = fileTypes.map(() => 'file_path LIKE ?').join(' OR ')
      sql += ` AND (${ors})`
      for (const ext of fileTypes) params.push(`%${ext}`)
    }

    sql += ' LIMIT ?'
    params.push(limit)

    const rows = await this.db.all(sql, params) as any[]

    const results: SearchResult[] = rows.map((r) => {
      const lowerLine = (r.content || '').toLowerCase()
      let match = query
      if (type === 'structural') {
        const q = query.toLowerCase()
        if (lowerLine.includes(`function ${q}`)) match = `function ${query}`
        else if (lowerLine.includes(`class ${q}`)) match = `class ${query}`
        else if (lowerLine.includes(`const ${q}`)) match = `const ${query}`
        else if (lowerLine.includes(`let ${q}`)) match = `let ${query}`
      }
      const idx = lowerLine.indexOf(query.toLowerCase())
      const start = Math.max(0, idx - 30)
      const end = Math.min((r.content || '').length, idx + query.length + 30)
      const context = (r.content || '').slice(start, end)
      const score = idx >= 0 ? Math.max(0.1, 1 - idx / Math.max(1, (r.content || '').length)) : 0.1
      return {
        file: r.file,
        line: r.line,
        content: r.content,
        match,
        context,
        score,
        type,
        language: this.detectLanguage(r.file)
      }
    })

    // Record history (best-effort)
    try {
      await this.db.run('INSERT INTO search_history (query, results_count, search_type, searched_at) VALUES (?, ?, ?, ?)', query, results.length, type, Date.now())
    } catch {}

    return results
  }

  private tokenize(text: string): string[] {
    // Simple tokenization for semantic search
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2)
  }

  private highlightMatch(content: string, query: string, caseSensitive: boolean): string {
    const regex = new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi')
    return content.replace(regex, '**$1**')
  }

  private getContext(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return content
    
    const start = Math.max(0, index - 40)
    const end = Math.min(content.length, index + query.length + 40)
    return content.substring(start, end)
  }

  private calculateScore(content: string, query: string, type: string): number {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    
    if (type === 'exact') {
      if (lowerContent.includes(lowerQuery)) {
        return 1.0
      }
      return 0.0
    }
    
    if (type === 'semantic') {
      const contentTokens = this.tokenize(content)
      const queryTokens = this.tokenize(query)
      const matches = queryTokens.filter(token => contentTokens.includes(token))
      return matches.length / Math.max(1, queryTokens.length)
    }
    
    if (type === 'structural') {
      // Higher score for structural matches
      if (lowerContent.includes(`function ${lowerQuery}`) || 
          lowerContent.includes(`class ${lowerQuery}`) ||
          lowerContent.includes(`const ${lowerQuery}`) ||
          lowerContent.includes(`let ${lowerQuery}`)) {
        return 1.0
      }
      return 0.5
    }
    
    return 0.0
  }

  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const languageMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript',
      '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
      '.py': 'python', '.pyx': 'python',
      '.java': 'java', '.kt': 'kotlin', '.scala': 'scala',
      '.go': 'go', '.rs': 'rust', '.cpp': 'cpp', '.c': 'c', '.h': 'c',
      '.php': 'php', '.rb': 'ruby', '.swift': 'swift',
      '.vue': 'vue', '.svelte': 'svelte',
      '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
      '.xml': 'xml', '.html': 'html', '.css': 'css', '.scss': 'scss',
      '.md': 'markdown', '.txt': 'text', '.sql': 'sql',
      '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell'
    }
    return languageMap[ext] || 'unknown'
  }

  async getSearchHistory(): Promise<{ queries: any[]; summary: any }> {
    await this.initialize()
    
    const queries = await this.db.all('SELECT * FROM search_history ORDER BY searched_at DESC LIMIT 20')
    const avg = queries.length > 0
      ? Math.round((queries.reduce((s: number, q: any) => s + (q.results_count || 0), 0) / queries.length) * 100) / 100
      : 0
    const summary = {
      totalSearches: queries.length,
      averageResults: avg,
      lastSearch: queries[0] ? new Date(queries[0].searched_at).toLocaleString() : 'Never',
      searchTypes: queries.reduce((acc: any, q: any) => {
        acc[q.search_type] = (acc[q.search_type] || 0) + 1
        return acc
      }, {})
    }
    
    return { queries, summary }
  }
}

export function registerCoreSearchTool({ mcp }: McpToolContext) {
  const searcher = new CoreSearcher()

  mcp.tool(
    'core_search',
    'Core Search — Context-aware search across the indexed project. Supports semantic and structural queries.',
    {
      // Align with spec
      query: z.string().describe('Natural language or keyword-based search string'),
      filters: z.object({
        language: z.string().optional(),
        fileTypes: z.array(z.string()).optional(),
        file: z.string().optional(),
      }).optional().describe('Optional filters: { language, fileTypes, file }'),
      type: z.enum(['exact', 'semantic', 'structural']).optional(),
      limit: z.number().optional(),
      caseSensitive: z.boolean().optional(),
      projectPath: z.string().optional(),
    },
    async (input) => {
      try {
        const projectPath = input.projectPath || process.cwd()
        
        // Auto-build search index if empty
        await searcher.ensureIndex(projectPath)
        
        const results = await searcher.search({
          query: input.query,
          type: input.type || 'exact',
          file: input.filters?.file,
          language: input.filters?.language,
          limit: input.limit || 20,
          caseSensitive: input.caseSensitive || false,
          fileTypes: input.filters?.fileTypes
        })
        
        const resultsText = results.length > 0 
          ? `\n\n🔎 Search Results:\n${results.map(r => 
              `  📄 ${r.file}:${r.line}\n    ${r.match}\n    Context: ${r.context}`
            ).join('\n\n')}`
          : '\n\n❌ No results found'
        
        return {
          content: [{ 
            type: 'text' as const, 
            text: `🔎 Search completed!\n\n` +
                  `📝 Query: "${input.query}"\n` +
                  `🔧 Type: ${input.type || 'exact'}\n` +
                  `📊 Results: ${results.length}` +
                  resultsText
          }],
          metadata: {
            query: input.query,
            type: input.type || 'exact',
            resultsCount: results.length,
            results
          }
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text' as const, 
            text: `❌ Core Search error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }],
          metadata: {
            error: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            resultsCount: 0,
            results: []
          }
        }
      }
    }
  )

  return { searcher }
} 
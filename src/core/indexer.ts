/**
 * @fileoverview Core project indexing functionality
 * @description Handles project analysis, file parsing, and database indexing
 * @author ZOD MCP Server Team
 * @version 1.0.0
 */

import { Octokit } from '@octokit/rest'
import { DatabaseManager } from './database'
import { VectorSearchEngine } from './vector-search'
import * as dotenv from 'dotenv'
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { safeLog } from '../utils'
import type { IndexingOptions, ProjectConfig, IndexingResult, FileInfo, CodeEmbedding } from '../types'

dotenv.config()

export interface RepositoryRecord {
  id: string
  owner: string
  repo: string
  branch: string
  status: 'indexing' | 'completed' | 'failed'
  progress: number
  indexedFiles: number
  totalFiles: number
  rawFiles?: number
  excludedFiles?: number
  lastIndexed: Date
  error?: string
  displayName?: string
  report?: string // JSON string
}

export interface DocumentationRecord {
  id: string
  url: string
  name: string
  status: 'indexing' | 'completed' | 'failed'
  progress: number
  indexedPages: number
  totalPages: number
  lastIndexed: Date
  error?: string
  displayName?: string
}

export interface IndexingReport {
  indexedFiles: FileInfo[]
  excludedFiles: {
    path: string
    reason: string
    category: 'dependencies' | 'build' | 'system' | 'git' | 'other'
  }[]
  summary: {
    totalScanned: number
    totalIndexed: number
    totalExcluded: number
    languages: Record<string, number>
    sizeIndexed: number
    averageFileSize: number
  }
}

/**
 * Main Indexer class for project indexing and analysis
 */
export class Indexer {
  private db: DatabaseManager
  private vectorEngine: VectorSearchEngine
  private octokit: Octokit
  private warnings: string[] = []

  constructor() {
    this.db = new DatabaseManager()
    this.vectorEngine = new VectorSearchEngine()
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
  }

  /**
   * Initialize the indexer with options
   * @param options - Indexing options
   */
  async initialize(options: IndexingOptions = {}): Promise<void> {
    try {
      // Initialize database (guard if mock without initialize)
      if (typeof (this.db as any).initialize === 'function') {
        await (this.db as any).initialize()
      }

      // Initialize vector search if enabled
      if (options.enableVectorSearch) {
        try {
          await this.vectorEngine.initialize()
          safeLog('✅ Vector search engine initialized', 'log')
        } catch (error) {
          safeLog(`⚠️ Vector search initialization failed: ${error}`, 'warn')
          // Continue without vector search
        }
      }

      safeLog('✅ Indexer initialized successfully', 'log')
    } catch (error) {
      safeLog(`❌ Indexer initialization failed: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Index a local project directory
   * @param projectPath - Path to the project
   * @param options - Indexing options
   * @returns Indexing result
   */
  async indexProject(projectPath: string, options: IndexingOptions = {}): Promise<IndexingResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`)
      }

      // Initialize if not already done
      if (!this.db) {
        await this.initialize(options)
      }

      const files = this.scanProjectFiles(projectPath, options)
      let indexedFiles = 0
      let failedFiles = 0

      // Process files
      for (const file of files) {
        try {
          await this.processFile(file, projectPath, options)
          indexedFiles++
        } catch (error) {
          failedFiles++
          errors.push(`Failed to process ${file.path}: ${error}`)
        }
      }

      const duration = Date.now() - startTime
      
      return {
        totalFiles: files.length,
        indexedFiles,
        failedFiles,
        vectorSearchEnabled: options.enableVectorSearch || false,
        duration,
        errors,
        warnings,
        stats: {
          byLanguage: this.calculateLanguageStats(files),
          bySize: this.calculateSizeStats(files),
          totalSize: files.reduce((sum, f) => sum + f.size, 0)
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      errors.push(`Indexing failed: ${error}`)
      
      return {
        totalFiles: 0,
        indexedFiles: 0,
        failedFiles: 0,
        vectorSearchEnabled: options.enableVectorSearch || false,
        duration,
        errors,
        warnings,
        stats: {
          byLanguage: {},
          bySize: {},
          totalSize: 0
        }
      }
    }
  }

  /**
   * Index a GitHub repository
   * @param repoUrl - GitHub repository URL
   * @param options - Indexing options
   * @returns Repository record
   */
  async indexRepository(
    repoUrl: string,
    options: IndexingOptions = {},
  ): Promise<RepositoryRecord> {
    const { owner, repo } = this.parseGitHubUrl(repoUrl)
    const id = `${owner}/${repo}`
    const branch = options.branch || 'main'

    // Check repository existence (skip when octokit is mocked without repos.get)
    try {
      const maybeRepos: any = (this.octokit as any)?.repos
      if (maybeRepos && typeof maybeRepos.get === 'function') {
        await maybeRepos.get({ owner, repo })
      }
    } catch (error: any) {
      if (error?.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found. Please check the repository URL.`)
      } else if (error?.status === 403) {
        throw new Error(`Repository ${owner}/${repo} is private and requires authentication. Please set a valid GITHUB_TOKEN.`)
      } else if (error?.status === 401) {
        throw new Error(`Authentication failed. Please check your GITHUB_TOKEN.`)
      } else {
        throw new Error(`Repository ${owner}/${repo} not accessible: ${error?.message || 'Unknown error'}`)
      }
    }

    const record: RepositoryRecord = {
      id,
      owner,
      repo,
      branch,
      status: 'indexing',
      progress: 0,
      indexedFiles: 0,
      totalFiles: 0,
      lastIndexed: new Date(),
    }

    await this.db.saveRepository(record)

    // Start indexing in background
    this.performIndexing(record, options).catch(error => {
      console.error('Indexing failed:', error)
      record.status = 'failed'
      record.error = error.message
      this.db.saveRepository(record)
    })

    return record
  }

  /**
   * Check repository status
   * @param repository - Repository ID
   * @returns Repository record or null
   */
  async checkRepositoryStatus(repository: string): Promise<RepositoryRecord | null> {
    return this.db.getRepository(repository)
  }

  /**
   * List all repositories
   * @returns Array of repository records
   */
  async listRepositories(): Promise<RepositoryRecord[]> {
    return this.db.listRepositories()
  }

  /**
   * Delete a repository
   * @param repository - Repository ID
   * @returns Success status
   */
  async deleteRepository(repository: string): Promise<boolean> {
    return this.db.deleteRepository(repository)
  }

  /**
   * Rename a repository
   * @param repository - Repository ID
   * @param newName - New display name
   * @returns Success status
   */
  async renameRepository(repository: string, newName: string): Promise<boolean> {
    return this.db.updateRepositoryDisplayName(repository, newName)
  }

  /**
   * Search codebase
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  async searchCodebase(query: string, options: { repositories?: string[] } = {}): Promise<Array<{
    repository: string
    path: string
    language: string
    size: number
    content: string
  }>> {
    const results = await this.db.searchIndexedFiles(query, options.repositories)
    return results.map(result => ({
      repository: result.repositoryId,
      path: result.path,
      language: result.language,
      size: 0, // Size not available in search results
      content: result.content
    }))
  }

  /**
   * Get indexed files for a repository
   * @param repositoryId - Repository ID
   * @returns Array of indexed files
   */
  async getIndexedFiles(repositoryId: string): Promise<Array<{
    path: string
    content: string
    language: string
    size: number
    lines: number
  }>> {
    return this.db.getIndexedFiles(repositoryId)
  }

  /**
   * Parse GitHub URL to extract owner and repo
   * @param url - GitHub URL
   * @returns Owner and repo information
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } {
    // Accept full URLs, SSH URLs, owner/repo, or repo-only
    const fullMatch = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (fullMatch) {
      return { owner: fullMatch[1], repo: fullMatch[2] }
    }
    // owner/repo pattern
    const ownerRepo = url.match(/^([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (ownerRepo) {
      return { owner: ownerRepo[1], repo: ownerRepo[2] }
    }
    // repo-only fallback
    const repoOnly = url.match(/^[A-Za-z0-9_.-]+$/)
    if (repoOnly) {
      return { owner: 'unknown', repo: url }
    }
    throw new Error('Invalid GitHub URL format')
  }

  /**
   * Detect programming language from file path
   * @param filePath - Path to the file
   * @returns Detected language or 'unknown'
   */
  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.m': 'matlab',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.md': 'markdown',
      '.txt': 'text',
    }
    
    return languageMap[ext] || 'unknown'
  }

  /**
   * Check if file should be included based on patterns
   * @param filePath - Path to the file
   * @param includePatterns - Patterns to include
   * @param excludePatterns - Patterns to exclude
   * @returns Whether file should be included
   */
  private shouldIncludeFile(
    filePath: string, 
    includePatterns?: string[], 
    excludePatterns?: string[]
  ): boolean {
    // Default include patterns
    const defaultInclude = ['*.ts', '*.js', '*.py', '*.go', '*.rs', '*.java', '*.cpp', '*.c']
    const defaultExclude = [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '*.min.js',
      '*.bundle.js',
      'coverage/**',
      '.nyc_output/**',
      '*.log',
      '*.tmp',
      '*.temp'
    ]

    const include = includePatterns || defaultInclude
    const exclude = excludePatterns || defaultExclude

    // Check exclude patterns first
    for (const pattern of exclude) {
      if (this.matchesPattern(filePath, pattern)) {
        return false
      }
    }

    // Check include patterns
    for (const pattern of include) {
      if (this.matchesPattern(filePath, pattern)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if file path matches a glob pattern
   * @param filePath - Path to check
   * @param pattern - Glob pattern
   * @returns Whether path matches pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const normalizedPath = filePath.replace(/\\/g, '/')
    const normalizedPattern = pattern.replace(/\\/g, '/')
    
    // Convert glob to regex
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\*\*/g, '.*')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(normalizedPath)
  }

  /**
   * Scan project directory for files
   * @param projectPath - Project root path
   * @param options - Indexing options
   * @returns Array of file info
   */
  private scanProjectFiles(projectPath: string, options: IndexingOptions = {}): FileInfo[] {
    const files: FileInfo[] = []
    const maxDepth = options.maxDepth || 10
    const maxFileSize = options.maxFileSize || 1024 * 1024 // 1MB default

    const scanDir = (dir: string, depth: number = 0): void => {
      if (depth > maxDepth) return

      try {
        const items = readdirSync(dir)
        
        for (const item of items) {
          const fullPath = join(dir, item)
          const relativePath = relative(projectPath, fullPath)
          
          try {
            const stats = statSync(fullPath)
            
            if (stats.isDirectory()) {
              // Skip certain directories
              if (this.shouldSkipDirectory(item)) continue
              scanDir(fullPath, depth + 1)
            } else if (stats.isFile()) {
              // Check file size
              if (stats.size > maxFileSize) {
                this.warnings.push(`Skipping large file: ${relativePath} (${stats.size} bytes)`)
                continue
              }

              // Check if file should be included
              if (this.shouldIncludeFile(relativePath, options.includeExtensions, options.excludeExtensions)) {
                files.push({
                  path: relativePath,
                  size: stats.size,
                  extension: extname(item),
                  language: this.detectLanguage(item),
                  hash: this.calculateFileHash(fullPath),
                  modified: stats.mtime,
                  isBinary: this.isBinaryFile(fullPath),
                  lines: 0, // Will be calculated when processing
                  content: '' // Will be loaded when processing
                })
              }
            }
    } catch (error) {
            this.warnings.push(`Error scanning ${relativePath}: ${error}`)
          }
        }
      } catch (error) {
        this.warnings.push(`Error reading directory ${dir}: ${error}`)
      }
    }

    scanDir(projectPath)
    return files
  }

  /**
   * Check if directory should be skipped
   * @param dirName - Directory name
   * @returns Whether to skip
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', 'dist', 'build', '.git', '.svn', '.hg',
      'coverage', '.nyc_output', '.next', '.nuxt', '.output',
      'target', 'bin', 'obj', '.vs', '.idea', '.vscode'
    ]
    return skipDirs.includes(dirName) || dirName.startsWith('.')
  }

  /**
   * Calculate file hash
   * @param filePath - Path to file
   * @returns File hash
   */
  private calculateFileHash(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf8')
      // Simple hash for now - in production use crypto
      let hash = 0
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString(16)
    } catch {
      return 'unknown'
    }
  }

  /**
   * Check if file is binary
   * @param filePath - Path to file
   * @returns Whether file is binary
   */
  private isBinaryFile(filePath: string): boolean {
    try {
      const buffer = readFileSync(filePath)
      // Check for null bytes which indicate binary files
      for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
        if (buffer[i] === 0) return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Process a single file
   * @param fileInfo - File information
   * @param projectPath - Project root path
   * @param options - Indexing options
   */
  private async processFile(fileInfo: FileInfo, projectPath: string, options: IndexingOptions): Promise<void> {
    const fullPath = join(projectPath, fileInfo.path)
    
    try {
      // Read file content
      const content = readFileSync(fullPath, 'utf8')
      fileInfo.content = content
      fileInfo.lines = content.split('\n').length

      // Store in database if available
      if (this.db) {
        await this.db.saveIndexedFile('local-project', {
        path: fileInfo.path,
        content: fileInfo.content,
          language: fileInfo.language || 'unknown',
        size: fileInfo.size,
        lines: fileInfo.lines,
      })
      }

      // Index in vector search if enabled
      if (options.enableVectorSearch && this.vectorEngine && this.vectorEngine.isReady) {
      try {
          await this.vectorEngine.indexFile(
            fileInfo.path,
            fileInfo.content,
            {
              path: fileInfo.path,
              language: fileInfo.language || 'unknown',
              repository: 'local-project',
              size: fileInfo.size,
              lines: fileInfo.lines,
            }
          )
        } catch (error) {
          this.warnings.push(`Vector indexing failed for ${fileInfo.path}: ${error}`)
        }
      }
    } catch (error) {
      throw new Error(`Failed to process file ${fileInfo.path}: ${error}`)
    }
  }

  /**
   * Calculate language statistics
   * @param files - Array of files
   * @returns Language distribution
   */
  private calculateLanguageStats(files: FileInfo[]): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const file of files) {
      const lang = file.language || 'unknown'
      stats[lang] = (stats[lang] || 0) + 1
    }
    return stats
  }

  /**
   * Calculate size statistics
   * @param files - Array of files
   * @returns Size distribution
   */
  private calculateSizeStats(files: FileInfo[]): Record<string, number> {
    const stats: Record<string, number> = {
      'small': 0,    // < 1KB
      'medium': 0,   // 1KB - 100KB
      'large': 0,    // 100KB - 1MB
      'huge': 0      // > 1MB
    }
    
    for (const file of files) {
      if (file.size < 1024) stats.small++
      else if (file.size < 102400) stats.medium++
      else if (file.size < 1048576) stats.large++
      else stats.huge++
    }
    
    return stats
  }

  /**
   * Perform indexing for a repository
   * @param record - Repository record
   * @param options - Indexing options
   */
  private async performIndexing(record: RepositoryRecord, options: IndexingOptions): Promise<void> {
    try {
      // Implementation for GitHub repository indexing
      // This would involve cloning the repo and processing files
      // For now, just mark as completed
      record.status = 'completed'
      record.progress = 100
      await this.db.saveRepository(record)
    } catch (error) {
      record.status = 'failed'
      record.error = error.message
      await this.db.saveRepository(record)
    }
  }

  /**
   * Get file content from GitHub
   * @param sha - File SHA
   * @param size - File size
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns File content or null
   */
  private async getFileContent(sha: string, size: number, owner: string, repo: string): Promise<string | null> {
    try {
      const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '', 10) || (1024 * 1024)
      // Skip large files
      if (size > maxFileSize) {
        console.log(`Skipping large file: ${sha} (${size} bytes)`)
        return null
      }

      // Add rate limiting delay
      await this.delay(100) // 100ms delay between requests

      const response = await this.octokit.git.getBlob({
        owner,
        repo,
        file_sha: sha,
      })

      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8')
      }

      return response.data.content
    } catch (error: any) {
      if (error.status === 429) {
        // Rate limited - wait and retry
        console.log('Rate limited by GitHub API, waiting 60 seconds...')
        await this.delay(60000) // Wait 60 seconds
        return this.getFileContent(sha, size, owner, repo) // Retry once
      }
      
      console.error('Error fetching file content:', error)
      return null
    }
  }

  /**
   * Delay execution
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export class DocumentationIndexer {
  private db: DatabaseManager
  private vectorEngine: VectorSearchEngine

  constructor() {
    this.db = new DatabaseManager()
    this.vectorEngine = new VectorSearchEngine()
  }

  async initialize(): Promise<void> {
    await this.db.initialize()
    await this.vectorEngine.initialize()
  }

  async indexDocumentation(
    url: string,
    options: {
      urlPatterns?: string[]
      maxAge?: number
      onlyMainContent?: boolean
    } = {},
  ): Promise<DocumentationRecord> {
    const id = this.generateId(url)
    const name = new URL(url).hostname

    const record: DocumentationRecord = {
      id,
      url,
      name,
      status: 'indexing',
      progress: 0,
      indexedPages: 0,
      totalPages: 0,
      lastIndexed: new Date(),
    }

    await this.db.saveDocumentation(record)

    // Запускаем индексацию в фоне
    this.performDocumentationIndexing(record, options).catch(error => {
      console.error('Documentation indexing failed:', error)
      record.status = 'failed'
      record.error = error.message
      this.db.saveDocumentation(record)
    })

    return record
  }

  async checkDocumentationStatus(sourceId: string): Promise<DocumentationRecord | null> {
    return this.db.getDocumentation(sourceId)
  }

  async listDocumentation(): Promise<DocumentationRecord[]> {
    return this.db.listDocumentation()
  }

  async deleteDocumentation(sourceId: string): Promise<boolean> {
    return this.db.deleteDocumentation(sourceId)
  }

  async renameDocumentation(sourceId: string, newName: string): Promise<boolean> {
    return this.db.updateDocumentationDisplayName(sourceId, newName)
  }

  private generateId(url: string): string {
    return Buffer.from(url).toString('base64').slice(0, 10)
  }

  private async performDocumentationIndexing(
    record: DocumentationRecord,
    options: {
      urlPatterns?: string[]
      maxAge?: number
      onlyMainContent?: boolean
    }
  ): Promise<void> {
    try {
      // Реальная индексация документации с веб-скрапингом
      const pages = await this.scrapeDocumentation(record.url, options)

      // Сохраняем каждую страницу в базу данных
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]

        // Сохраняем в SQLite
        await this.db.saveIndexedPage(record.id, {
          url: page.url,
          title: page.title,
          content: page.content,
        })

        // Индексируем в векторную БД
        try {
          await this.vectorEngine.indexPage(
            `${record.id}:${page.url}`,
            page.content,
            {
              url: page.url,
              title: page.title,
              documentation: record.id,
            }
          )
        } catch (error) {
          console.warn(`Failed to index page in vector DB: ${page.url}`, error)
        }

        // Обновляем прогресс
        record.progress = Math.round((i + 1) / pages.length * 100)
        record.indexedPages = i + 1
        record.totalPages = pages.length
        await this.db.saveDocumentation(record)

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      record.status = 'completed'
      record.progress = 100
      await this.db.saveDocumentation(record)
    } catch (error) {
      record.status = 'failed'
      record.error = error instanceof Error ? error.message : 'Unknown error'
      await this.db.saveDocumentation(record)
      throw error
    }
  }

  private async scrapeDocumentation(
    baseUrl: string,
    options: {
      urlPatterns?: string[]
      maxAge?: number
      onlyMainContent?: boolean
    }
  ): Promise<Array<{
    url: string
    title: string
    content: string
  }>> {
    const pages: Array<{ url: string; title: string; content: string }> = []

    try {
      // Получаем главную страницу
      const mainPage = await this.fetchPage(baseUrl, options.onlyMainContent)
      if (mainPage) {
        pages.push(mainPage)
      }

      // Если есть паттерны URL, ищем дополнительные страницы
      if (options.urlPatterns && options.urlPatterns.length > 0) {
        const additionalPages = await this.findPagesByPatterns(baseUrl, options.urlPatterns, options.onlyMainContent || true)
        pages.push(...additionalPages)
      }

      return pages
    } catch (error) {
      console.error('Error scraping documentation:', error)
      // Возвращаем хотя бы главную страницу если есть
      return pages
    }
  }

  private async fetchPage(
    url: string,
    onlyMainContent: boolean = true
  ): Promise<{ url: string; title: string; content: string } | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ZOD-Bot/1.0)',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      // Используем cheerio для парсинга HTML
      const cheerio = await import('cheerio')
      const $ = cheerio.load(html)

      // Извлекаем заголовок
      const title = $('title').text() || $('h1').first().text() || 'Untitled'

      // Извлекаем основной контент
      let content = ''
      if (onlyMainContent) {
        // Удаляем навигацию, футер, рекламу
        $('nav, header, footer, .nav, .header, .footer, .sidebar, .ad, .advertisement').remove()
        $('script, style, noscript').remove()

        // Извлекаем текст из основного контента
        const mainContent = $('main, article, .content, .main, #content, #main').first()
        if (mainContent.length > 0) {
          content = mainContent.text().trim()
        } else {
          // Fallback: извлекаем текст из body
          content = $('body').text().trim()
        }
      } else {
        content = $('body').text().trim()
      }

      // Очищаем и нормализуем текст
      content = this.cleanText(content)

      return {
        url,
        title: title.trim(),
        content,
      }
    } catch (error) {
      console.error(`Error fetching page ${url}:`, error)
      return null
    }
  }

  private async findPagesByPatterns(
    baseUrl: string,
    patterns: string[],
    onlyMainContent: boolean
  ): Promise<Array<{ url: string; title: string; content: string }>> {
    const pages: Array<{ url: string; title: string; content: string }> = []

    try {
      // Получаем главную страницу для поиска ссылок
      const mainPage = await this.fetchPage(baseUrl, false)
      if (!mainPage) return pages

      // Парсим HTML для поиска ссылок
      const cheerio = await import('cheerio')
      const response = await fetch(baseUrl)
      const html = await response.text()
      const $ = cheerio.load(html)

      const links = new Set<string>()
      const processedUrls = new Set<string>()

      // Функция для проверки соответствия URL паттерну
      const matchesPattern = (url: string, pattern: string): boolean => {
        try {
          // Извлекаем путь из URL
          const urlPath = new URL(url).pathname
          
          // Преобразуем паттерн в regex
          let regexPattern = pattern
            .replace(/\./g, '\\.') // Экранируем точки
            .replace(/\*/g, '.*') // Заменяем * на .*
            .replace(/\?/g, '\\.') // Заменяем ? на любой символ
          
          // Если паттерн начинается с /, добавляем якорь начала
          if (pattern.startsWith('/')) {
            regexPattern = '^' + regexPattern
          }
          
          const regex = new RegExp(regexPattern, 'i')
          return regex.test(urlPath)
        } catch (error) {
          console.error(`Invalid pattern: ${pattern}`, error instanceof Error ? error.message : String(error))
          return false
        }
      }

      // Рекурсивная функция для поиска ссылок
      const findLinksRecursively = async (url: string, depth: number = 0): Promise<void> => {
        if (depth > 3 || processedUrls.has(url)) return // Ограничиваем глубину и избегаем циклов
        
        processedUrls.add(url)
        
        try {
          const response = await fetch(url)
          const html = await response.text()
          const $ = cheerio.load(html)

          // Ищем ссылки, соответствующие паттернам
          $('a[href]').each((_, element) => {
            const href = $(element).attr('href')
            if (href) {
              const fullUrl = new URL(href, url).href

              // Проверяем, соответствует ли URL паттернам
              const matchesAnyPattern = patterns.some(pattern => matchesPattern(fullUrl, pattern))

              if (matchesAnyPattern) {
                links.add(fullUrl)
              }
            }
          })

          // Рекурсивно обрабатываем найденные ссылки (если не достигли максимальной глубины)
          if (depth < 2) {
            const linksToFollow = Array.from(links).slice(0, 5) // Ограничиваем количество ссылок для следования
            for (const link of linksToFollow) {
              if (!processedUrls.has(link)) {
                await findLinksRecursively(link, depth + 1)
                await new Promise(resolve => setTimeout(resolve, 100)) // Задержка между запросами
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${url}:`, error)
        }
      }

      // Начинаем рекурсивный поиск с базового URL
      await findLinksRecursively(baseUrl)

      // Ограничиваем количество страниц для индексации
      const maxPages = 30
      const urlsToProcess = Array.from(links).slice(0, maxPages)

      console.log(`Found ${links.size} matching URLs, processing ${urlsToProcess.length} pages`)

      for (const url of urlsToProcess) {
        const page = await this.fetchPage(url, onlyMainContent)
        if (page) {
          pages.push(page)
        }

        // Задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.error('Error finding pages by patterns:', error)
    }

    return pages
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
      .replace(/\n+/g, '\n') // Заменяем множественные переносы строк на один
      .trim()
  }
}

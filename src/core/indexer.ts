import { Octokit } from '@octokit/rest'
import { DatabaseManager } from './database'
import { VectorSearchEngine } from './vector-search'
import * as dotenv from 'dotenv'

dotenv.config()

export interface IndexingOptions {
  branch?: string
  maxFiles?: number
  maxFileSizeBytes?: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface FileInfo {
  path: string
  size: number
  language: string
  lines: number
  content: string
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

export class RepositoryIndexer {
  private octokit: Octokit
  private db: DatabaseManager
  private vectorEngine: VectorSearchEngine

  constructor() {
    const token = process.env.GITHUB_TOKEN
    if (!token || token === 'your_github_token_here') {
      if (!process.argv.includes('--stdio')) {
        console.warn('GITHUB_TOKEN not configured, using unauthenticated requests (limited to public repos)')
      }
    } else {
      if (!process.argv.includes('--stdio')) {
        console.log('GitHub token found, using authenticated requests')
      }
    }

    this.octokit = new Octokit({
      auth: token && token !== 'your_github_token_here' ? token : undefined,
    })

    this.db = new DatabaseManager()
    this.vectorEngine = new VectorSearchEngine()
  }

  async initialize(): Promise<void> {
    await this.db.initialize()
    await this.vectorEngine.initialize()
  }

  async indexRepository(
    repoUrl: string,
    options: IndexingOptions = {},
  ): Promise<RepositoryRecord> {
    const { owner, repo } = this.parseGitHubUrl(repoUrl)
    const id = `${owner}/${repo}`
    const branch = options.branch || 'main'

    // Проверяем существование репозитория
    try {
      await this.octokit.repos.get({ owner, repo })
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found. Please check the repository URL.`)
      } else if (error.status === 403) {
        throw new Error(`Repository ${owner}/${repo} is private and requires authentication. Please set a valid GITHUB_TOKEN.`)
      } else if (error.status === 401) {
        throw new Error(`Authentication failed. Please check your GITHUB_TOKEN.`)
      } else {
        throw new Error(`Repository ${owner}/${repo} not accessible: ${error.message || 'Unknown error'}`)
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

    // Запускаем индексацию в фоне
    this.performIndexing(record, options).catch(error => {
      console.error('Indexing failed:', error)
      record.status = 'failed'
      record.error = error.message
      this.db.saveRepository(record)
    })

    return record
  }

  async checkRepositoryStatus(repository: string): Promise<RepositoryRecord | null> {
    return this.db.getRepository(repository)
  }

  async listRepositories(): Promise<RepositoryRecord[]> {
    return this.db.listRepositories()
  }

  async deleteRepository(repository: string): Promise<boolean> {
    return this.db.deleteRepository(repository)
  }

  async renameRepository(repository: string, newName: string): Promise<boolean> {
    return this.db.updateRepositoryDisplayName(repository, newName)
  }

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

  async getIndexedFiles(repositoryId: string): Promise<Array<{
    path: string
    content: string
    language: string
    size: number
    lines: number
  }>> {
    return this.db.getIndexedFiles(repositoryId)
  }

  parseGitHubUrl(url: string): { owner: string, repo: string } {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      throw new Error('Invalid GitHub URL')
    }
    return { owner: match[1], repo: match[2] }
  }

  private async performIndexing(record: RepositoryRecord, options: IndexingOptions): Promise<void> {
    try {
      // Update initial progress
      record.progress = 10
      record.status = 'indexing'
      await this.db.saveRepository(record)

      // Получаем дерево файлов из GitHub API
      const tree = await this.getRepositoryTree(record.owner, record.repo, record.branch)

      // Update progress after getting tree
      record.progress = 30
      record.rawFiles = tree.length
      await this.db.saveRepository(record)

      // Проверяем, пустой ли репозиторий
      if (tree.length === 0) {
        // Создаем отчет для пустого репозитория
        const report: IndexingReport = {
          indexedFiles: [],
          excludedFiles: [],
          summary: {
            totalScanned: 0,
            totalIndexed: 0,
            totalExcluded: 0,
            languages: {},
            sizeIndexed: 0,
            averageFileSize: 0,
          },
        }

        // Обновляем запись в базе данных
        record.status = 'completed'
        record.progress = 100
        record.indexedFiles = 0
        record.totalFiles = 0
        record.report = JSON.stringify(report)
        await this.db.saveRepository(record)
        return
      }

      // Обрабатываем файлы
      const { indexedFiles, excludedFiles } = await this.filterAndProcessFiles(
        tree,
        record.id,
        record.owner,
        record.repo,
        options
      )

      // Update progress after processing files
      record.progress = 90
      record.indexedFiles = indexedFiles.length
      record.totalFiles = tree.length
      record.excludedFiles = excludedFiles.length
      await this.db.saveRepository(record)

      // Создаем отчет
      const languageStats = this.calculateLanguageStats(indexedFiles)
      const totalSize = indexedFiles.reduce((sum, file) => sum + file.size, 0)
      const averageFileSize = indexedFiles.length > 0 ? totalSize / indexedFiles.length : 0

      const report: IndexingReport = {
        indexedFiles,
        excludedFiles,
        summary: {
          totalScanned: tree.length,
          totalIndexed: indexedFiles.length,
          totalExcluded: excludedFiles.length,
          languages: languageStats,
          sizeIndexed: totalSize,
          averageFileSize,
        },
      }

      // Обновляем запись в базе данных
      record.status = 'completed'
      record.progress = 100
      record.report = JSON.stringify(report)
      await this.db.saveRepository(record)

      console.log(`✅ Indexing completed: ${record.id} - ${indexedFiles.length} files indexed`)
    } catch (error) {
      console.error('Indexing failed:', error)
      record.status = 'failed'
      record.error = error.message
      await this.db.saveRepository(record)
      throw error
    }
  }

  private async getRepositoryTree(owner: string, repo: string, branch: string): Promise<Array<{
    path: string
    size: number
    type: string
    sha: string
  }>> {
    try {
      // Сначала получаем информацию о репозитории
      const repoInfo = await this.octokit.repos.get({
        owner,
        repo,
      })

      // Проверяем, пустой ли репозиторий
      if (repoInfo.data.size === 0) {
        console.log(`Repository ${owner}/${repo} is empty`)
        return []
      }

      // Resolve the target branch to a commit SHA
      const targetBranch = branch || repoInfo.data.default_branch
      let treeSha = targetBranch
      try {
        const branchInfo = await this.octokit.repos.getBranch({ owner, repo, branch: targetBranch })
        treeSha = branchInfo.data.commit.sha
      } catch (e: any) {
        // If branch resolution fails (e.g., branch not found), fallback to default branch
        if (targetBranch !== repoInfo.data.default_branch) {
          const defaultBranch = repoInfo.data.default_branch
          try {
            const branchInfo = await this.octokit.repos.getBranch({ owner, repo, branch: defaultBranch })
            treeSha = branchInfo.data.commit.sha
          } catch {
            // Keep original ref as a last resort; GitHub may still accept a ref name
            treeSha = targetBranch
          }
        }
      }

      // Получаем дерево файлов
      const response = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: 'true',
      })

      const files = response.data.tree
        .filter(item => item.type === 'blob')
        .map(item => ({
          path: item.path!,
          size: item.size || 0,
          type: item.type!,
          sha: item.sha!,
        }))

      // Add some debugging info
      console.log(`Found ${files.length} files in repository ${owner}/${repo} (branch: ${targetBranch})`)

      return files
    } catch (error) {
      if (error.status === 429) {
        // Rate limited - wait and retry
        console.log('Rate limited by GitHub API, waiting 60 seconds...')
        await this.delay(60000) // Wait 60 seconds
        return this.getRepositoryTree(owner, repo, branch) // Retry once
      }

      console.error('Error fetching repository tree:', error)

      // Проверяем, является ли ошибка связанной с пустым репозиторием
      if (error.message && error.message.includes('Git Repository is empty')) {
        console.log(`Repository ${owner}/${repo} is empty`)
        return []
      }

      throw new Error(`Failed to fetch repository tree: ${error}`)
    }
  }

  private async filterAndProcessFiles(
    tree: Array<{ path: string; size: number; type: string; sha: string }>,
    repositoryId: string,
    owner: string,
    repo: string,
    options: IndexingOptions
  ): Promise<{
    indexedFiles: FileInfo[]
    excludedFiles: { path: string; reason: string; category: 'dependencies' | 'build' | 'system' | 'git' | 'other' }[]
  }> {
    const indexedFiles: FileInfo[] = []
    const excludedFiles: { path: string; reason: string; category: 'dependencies' | 'build' | 'system' | 'git' | 'other' }[] = []
    const envMax = parseInt(process.env.MAX_FILE_COUNT || '', 10)
    const maxFiles = Number.isFinite(envMax) && envMax > 0
      ? (options.maxFiles ?? envMax)
      : (options.maxFiles ?? tree.length)
    const maxFileSize = options.maxFileSizeBytes ?? (parseInt(process.env.MAX_FILE_SIZE || '', 10) || (1024 * 1024))

    // Pre-filter by include/exclude patterns to avoid unnecessary API calls
    const includePatterns = options.includePatterns && options.includePatterns.length > 0 ? options.includePatterns : null
    const extraExcludePatterns = options.excludePatterns || []

    const items = tree.filter(item => {
      if (indexedFiles.length >= maxFiles) return false
      // Binary extensions excluded early
      if (this.isBinaryExtension(item.path)) return false
      if (this.shouldExcludeFile(item.path, extraExcludePatterns)) return false
      if (includePatterns && !this.matchesAnyPattern(item.path, includePatterns)) return false
      if (item.size && item.size > maxFileSize) return false
      return true
    })

    const record = await this.db.getRepository(repositoryId)
    if (!record) {
      throw new Error('Repository record not found')
    }

    const concurrency = Math.max(1, Math.min(16, parseInt(process.env.INDEX_CONCURRENCY || '5', 10)))
    let processed = 0
    const processOne = async (item: { path: string; size: number; type: string; sha: string }) => {
      if (indexedFiles.length >= maxFiles) return
      // Получаем содержимое файла
      const content = await this.getFileContent(item.sha, item.size, owner, repo)
      if (!content) {
        excludedFiles.push({
          path: item.path,
          reason: 'Failed to fetch content',
          category: 'other'
        })
        return
      }

      // Создаем информацию о файле
      const fileInfo: FileInfo = {
        path: item.path,
        size: item.size,
        language: this.detectLanguage(item.path),
        lines: content.split('\n').length,
        content: content,
      }

      // Сохраняем в базу данных
      await this.db.saveIndexedFile(repositoryId, {
        path: fileInfo.path,
        content: fileInfo.content,
        language: fileInfo.language,
        size: fileInfo.size,
        lines: fileInfo.lines,
      })

      // Пытаемся индексировать в векторной базе (опционально)
      try {
        if (this.vectorEngine) {
          await this.vectorEngine.indexFile(
            `${repositoryId}:${fileInfo.path}`,
            fileInfo.content,
            {
              path: fileInfo.path,
              language: fileInfo.language,
              repository: repositoryId,
              size: fileInfo.size,
              lines: fileInfo.lines,
            }
          )
        }
      } catch (error: any) {
        // Vector search is optional, don't fail the indexing
        console.log(`Failed to index file in vector DB: ${fileInfo.path} Error: ${error.message}`)
      }

      indexedFiles.push(fileInfo)
      processed++

      // Update progress periodically
      if (processed % 25 === 0 || processed === items.length) {
        const progress = Math.min(90, 50 + Math.round((processed / Math.max(1, items.length)) * 40))
        record.progress = progress
        record.indexedFiles = indexedFiles.length
        record.totalFiles = tree.length
        await this.db.saveRepository(record)
      }
    }

    // Simple batching for concurrency control
    let batch: Promise<void>[] = []
    for (const item of items) {
      batch.push(processOne(item))
      if (batch.length >= concurrency) {
        await Promise.allSettled(batch)
        batch = []
      }
    }
    if (batch.length) {
      await Promise.allSettled(batch)
    }

    return { indexedFiles, excludedFiles }
  }

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
    } catch (error) {
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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private shouldExcludeFile(path: string): boolean {
    const excludePatterns = [
      'node_modules/',
      'vendor/',
      'bower_components/',
      'dist/',
      'build/',
      '.next/',
      'out/',
      '.DS_Store',
      'Thumbs.db',
      '.Spotlight-V100',
      '.git/',
      '.gitignore',
      '.gitattributes',
      '*.log',
      '*.tmp',
      '*.cache',
      '.env',
      '.env.local',
      '.env.production',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ]

    return excludePatterns.some((pattern) => this.matchesPattern(path, pattern))
  }

  // Enhanced pattern matching supporting ** and * globs
  private matchesPattern(path: string, pattern: string): boolean {
    // Escape regex special chars except *
    const escaped = pattern
      .replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')
      .replace(/\*\*/g, '::GLOBSTAR::')
      .replace(/\*/g, '[^/]*')
      .replace(/::GLOBSTAR::/g, '.*')
    const regex = new RegExp('^' + escaped + '$')
    return regex.test(path)
  }

  private matchesAnyPattern(path: string, patterns: string[]): boolean {
    return patterns.some(p => this.matchesPattern(path, p))
  }

  private isBinaryExtension(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase()
    if (!ext) return false
    const binaryExts = new Set([
      'png','jpg','jpeg','gif','bmp','webp','ico','svg',
      'pdf','zip','gz','tar','rar','7z','xz','bz2',
      'mp3','mp4','mov','avi','mkv','wav','flac',
      'woff','woff2','ttf','otf',
      'wasm','iso','dmg','exe','dll','so','bin'
    ])
    return binaryExts.has(ext)
  }

  private getExclusionReason(path: string): string {
    if (path.includes('node_modules/')) return 'Dependencies directory'
    if (path.includes('dist/') || path.includes('build/')) return 'Build output'
    if (path.includes('.git/')) return 'Git metadata'
    if (path.includes('.env')) return 'Environment file'
    if (path.includes('*.log')) return 'Log file'
    if (path.includes('package-lock.json') || path.includes('yarn.lock')) return 'Lock file'
    return 'Excluded by pattern'
  }

  private getExclusionCategory(path: string): 'dependencies' | 'build' | 'system' | 'git' | 'other' {
    if (path.includes('node_modules/') || path.includes('vendor/')) return 'dependencies'
    if (path.includes('dist/') || path.includes('build/')) return 'build'
    if (path.includes('.git/')) return 'git'
    if (path.includes('.DS_Store') || path.includes('Thumbs.db')) return 'system'
    return 'other'
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      mdx: 'Markdown',
      md: 'Markdown',
      json: 'JSON',
      yml: 'YAML',
      yaml: 'YAML',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'SASS',
      html: 'HTML',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      cc: 'C++',
      cxx: 'C++',
      c: 'C',
      rs: 'Rust',
      go: 'Go',
      php: 'PHP',
      rb: 'Ruby',
      swift: 'Swift',
      kt: 'Kotlin',
      toml: 'TOML',
      ini: 'INI',
      sh: 'Shell',
      bash: 'Shell',
    }
    return languageMap[ext || ''] || 'Text'
  }

  private calculateLanguageStats(files: FileInfo[]): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const file of files) {
      stats[file.language] = (stats[file.language] || 0) + 1
    }
    return stats
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

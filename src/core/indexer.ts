import { Octokit } from '@octokit/rest'
import { DatabaseManager } from './database'
import { VectorSearchEngine } from './vector-search'
import * as dotenv from 'dotenv'

dotenv.config()

export interface IndexingOptions {
  branch?: string
  maxFiles?: number
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
    if (!token) {
      console.warn('GITHUB_TOKEN not configured, some features may not work')
    }

    this.octokit = new Octokit({
      auth: token,
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
    } catch (error) {
      throw new Error(`Repository ${owner}/${repo} not found or not accessible`)
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

  private parseGitHubUrl(url: string): { owner: string, repo: string } {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      throw new Error('Invalid GitHub URL')
    }
    return { owner: match[1], repo: match[2] }
  }

  private async performIndexing(record: RepositoryRecord, options: IndexingOptions): Promise<void> {
    try {
      // Получаем дерево файлов из GitHub API
      const tree = await this.getRepositoryTree(record.owner, record.repo, record.branch)

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
        record.rawFiles = 0
        record.excludedFiles = 0
        record.report = JSON.stringify(report)
        record.lastIndexed = new Date()

        await this.db.saveRepository(record)
        return
      }

      // Фильтруем файлы
      const { indexedFiles, excludedFiles } = await this.filterAndProcessFiles(
        tree,
        record.id,
        record.owner,
        record.repo,
        options
      )

      // Создаем отчет
      const report: IndexingReport = {
        indexedFiles,
        excludedFiles,
        summary: {
          totalScanned: tree.length,
          totalIndexed: indexedFiles.length,
          totalExcluded: excludedFiles.length,
          languages: this.calculateLanguageStats(indexedFiles),
          sizeIndexed: indexedFiles.reduce((sum, file) => sum + file.size, 0),
          averageFileSize: 0,
        },
      }

      if (indexedFiles.length > 0) {
        report.summary.averageFileSize = Math.round(report.summary.sizeIndexed / indexedFiles.length)
      }

      // Обновляем запись в базе данных
      record.status = 'completed'
      record.progress = 100
      record.indexedFiles = indexedFiles.length
      record.totalFiles = indexedFiles.length
      record.rawFiles = tree.length
      record.excludedFiles = excludedFiles.length
      record.report = JSON.stringify(report)
      record.lastIndexed = new Date()

      await this.db.saveRepository(record)
    } catch (error) {
      record.status = 'failed'
      record.error = error instanceof Error ? error.message : 'Unknown error'
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

      // Получаем дерево файлов
      const response = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true',
      })

      return response.data.tree
        .filter(item => item.type === 'blob')
        .map(item => ({
          path: item.path!,
          size: item.size || 0,
          type: item.type!,
          sha: item.sha!,
        }))
    } catch (error) {
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
    const maxFiles = options.maxFiles || 1000

    for (const item of tree) {
      if (indexedFiles.length >= maxFiles) {
        break
      }

      // Проверяем исключения
      if (this.shouldExcludeFile(item.path)) {
        const reason = this.getExclusionReason(item.path)
        const category = this.getExclusionCategory(item.path)
        excludedFiles.push({ path: item.path, reason, category })
        continue
      }

      // Получаем содержимое файла
      const content = await this.getFileContent(item.sha, item.size, owner, repo)
      if (!content) {
        excludedFiles.push({
          path: item.path,
          reason: 'Failed to fetch content',
          category: 'other'
        })
        continue
      }

      // Определяем язык программирования
      const language = this.detectLanguage(item.path)
      const lines = content.split('\n').length

      const fileInfo: FileInfo = {
        path: item.path,
        size: item.size,
        language,
        lines,
        content,
      }

      // Сохраняем в SQLite
      await this.db.saveIndexedFile(repositoryId, {
        path: fileInfo.path,
        content: fileInfo.content,
        language: fileInfo.language,
        size: fileInfo.size,
        lines: fileInfo.lines,
      })

      // Индексируем в векторную БД
      try {
        await this.vectorEngine.indexFile(
          `${repositoryId}:${item.path}`,
          fileInfo.content,
          {
            path: fileInfo.path,
            language: fileInfo.language,
            repository: repositoryId,
            size: fileInfo.size,
            lines: fileInfo.lines,
          }
        )
      } catch (error) {
        console.warn(`Failed to index file in vector DB: ${item.path}`, error)
      }

      indexedFiles.push(fileInfo)
    }

    return { indexedFiles, excludedFiles }
  }

  private async getFileContent(sha: string, size: number, owner: string, repo: string): Promise<string | null> {
    // Пропускаем слишком большие файлы
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '1024000')
    if (size > maxSize) {
      return null
    }

    try {
      const response = await this.octokit.git.getBlob({
        owner,
        repo,
        file_sha: sha,
      })

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      return content
    } catch (error) {
      console.error('Error fetching file content:', error)
      return null
    }
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

    return excludePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'))
        return regex.test(path)
      }
      return path.includes(pattern)
    })
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
          'User-Agent': 'Mozilla/5.0 (compatible; NIA-Bot/1.0)',
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

      // Ищем ссылки, соответствующие паттернам
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href')
        if (href) {
          const fullUrl = new URL(href, baseUrl).href

          // Проверяем, соответствует ли URL паттернам
          const matchesPattern = patterns.some(pattern => {
            if (pattern.startsWith('/')) {
              return fullUrl.includes(pattern)
            }
            return fullUrl.includes(pattern)
          })

          if (matchesPattern) {
            links.add(fullUrl)
          }
        }
      })

      // Ограничиваем количество страниц для индексации
      const maxPages = 20
      const urlsToProcess = Array.from(links).slice(0, maxPages)

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

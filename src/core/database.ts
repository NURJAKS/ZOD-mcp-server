import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'
import fs from 'fs'

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

export class DatabaseManager {
    private db: Database | null = null
    private dbPath: string

    constructor() {
        // Создаем директорию data если её нет
        const dataDir = path.join(process.cwd(), 'data')
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
        }

        this.dbPath = path.join(dataDir, 'zod.db')
    }

    async initialize(): Promise<void> {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database,
        })

        // Создаем таблицы
        await this.createTables()
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized')

        // Таблица репозиториев
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        branch TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        indexedFiles INTEGER DEFAULT 0,
        totalFiles INTEGER DEFAULT 0,
        rawFiles INTEGER,
        excludedFiles INTEGER,
        lastIndexed DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        displayName TEXT,
        report TEXT
      )
    `)

        // Таблица документации
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS documentation (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        indexedPages INTEGER DEFAULT 0,
        totalPages INTEGER DEFAULT 0,
        lastIndexed DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        displayName TEXT
      )
    `)

        // Таблица индексированных файлов
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repositoryId TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT,
        language TEXT,
        size INTEGER,
        lines INTEGER,
        embedding TEXT,
        lastIndexed DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repositoryId) REFERENCES repositories (id) ON DELETE CASCADE
      )
    `)

        // Таблица индексированных страниц документации
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documentationId TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT,
        embedding TEXT,
        lastIndexed DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentationId) REFERENCES documentation (id) ON DELETE CASCADE
      )
    `)

        // Создаем индексы для быстрого поиска
        await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories (status)
    `)
        await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_indexed_files_repository ON indexed_files (repositoryId)
    `)
        await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_indexed_pages_documentation ON indexed_pages (documentationId)
    `)
    }

    // Методы для работы с репозиториями
    async saveRepository(repo: RepositoryRecord): Promise<void> {
        if (!this.db) throw new Error('Database not initialized')

        await this.db.run(`
      INSERT OR REPLACE INTO repositories 
      (id, owner, repo, branch, status, progress, indexedFiles, totalFiles, rawFiles, excludedFiles, lastIndexed, error, displayName, report)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            repo.id, repo.owner, repo.repo, repo.branch, repo.status, repo.progress,
            repo.indexedFiles, repo.totalFiles, repo.rawFiles, repo.excludedFiles,
            repo.lastIndexed.toISOString(), repo.error, repo.displayName, repo.report
        ])
    }

    async getRepository(id: string): Promise<RepositoryRecord | null> {
        if (!this.db) throw new Error('Database not initialized')

        const row = await this.db.get('SELECT * FROM repositories WHERE id = ?', [id])
        if (!row) return null

        return {
            ...row,
            lastIndexed: new Date(row.lastIndexed),
        } as RepositoryRecord
    }

    async listRepositories(): Promise<RepositoryRecord[]> {
        if (!this.db) throw new Error('Database not initialized')

        const rows = await this.db.all('SELECT * FROM repositories ORDER BY lastIndexed DESC')
        return rows.map(row => ({
            ...row,
            lastIndexed: new Date(row.lastIndexed),
        })) as RepositoryRecord[]
    }

    async deleteRepository(id: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized')

        const result = await this.db.run('DELETE FROM repositories WHERE id = ?', [id])
        return result.changes > 0
    }

    async updateRepositoryDisplayName(id: string, displayName: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized')

        const result = await this.db.run(
            'UPDATE repositories SET displayName = ? WHERE id = ?',
            [displayName, id]
        )
        return result.changes > 0
    }

    // Методы для работы с документацией
    async saveDocumentation(doc: DocumentationRecord): Promise<void> {
        if (!this.db) throw new Error('Database not initialized')

        await this.db.run(`
      INSERT OR REPLACE INTO documentation 
      (id, url, name, status, progress, indexedPages, totalPages, lastIndexed, error, displayName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            doc.id, doc.url, doc.name, doc.status, doc.progress,
            doc.indexedPages, doc.totalPages, doc.lastIndexed.toISOString(),
            doc.error, doc.displayName
        ])
    }

    async getDocumentation(id: string): Promise<DocumentationRecord | null> {
        if (!this.db) throw new Error('Database not initialized')

        const row = await this.db.get('SELECT * FROM documentation WHERE id = ?', [id])
        if (!row) return null

        return {
            ...row,
            lastIndexed: new Date(row.lastIndexed),
        } as DocumentationRecord
    }

    async listDocumentation(): Promise<DocumentationRecord[]> {
        if (!this.db) throw new Error('Database not initialized')

        const rows = await this.db.all('SELECT * FROM documentation ORDER BY lastIndexed DESC')
        return rows.map(row => ({
            ...row,
            lastIndexed: new Date(row.lastIndexed),
        })) as DocumentationRecord[]
    }

    async deleteDocumentation(id: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized')

        const result = await this.db.run('DELETE FROM documentation WHERE id = ?', [id])
        return result.changes > 0
    }

    async updateDocumentationDisplayName(id: string, displayName: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized')

        const result = await this.db.run(
            'UPDATE documentation SET displayName = ? WHERE id = ?',
            [displayName, id]
        )
        return result.changes > 0
    }

    // Методы для работы с индексированными файлами
    async saveIndexedFile(repositoryId: string, file: {
        path: string
        content: string
        language: string
        size: number
        lines: number
        embedding?: string
    }): Promise<void> {
        if (!this.db) throw new Error('Database not initialized')

        await this.db.run(`
      INSERT OR REPLACE INTO indexed_files 
      (repositoryId, path, content, language, size, lines, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
            repositoryId, file.path, file.content, file.language,
            file.size, file.lines, file.embedding
        ])
    }

    async getIndexedFiles(repositoryId: string): Promise<Array<{
        path: string
        content: string
        language: string
        size: number
        lines: number
        embedding?: string
    }>> {
        if (!this.db) throw new Error('Database not initialized')

        const rows = await this.db.all(
            'SELECT path, content, language, size, lines, embedding FROM indexed_files WHERE repositoryId = ?',
            [repositoryId]
        )
        return rows
    }

    async searchIndexedFiles(query: string, repositoryIds?: string[]): Promise<Array<{
        repositoryId: string
        path: string
        content: string
        language: string
        score: number
    }>> {
        if (!this.db) throw new Error('Database not initialized')

        console.log(`Search query: "${query}"`)
        console.log(`Repository IDs:`, repositoryIds)

        // Split query into words for better search, but allow shorter words
        const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 1)
        
        if (words.length === 0) {
            // If no words found, try the original query
            words.push(query.toLowerCase())
        }

        console.log(`Search words:`, words)

        // Build search conditions for each word
        const conditions = words.map(word => `LOWER(content) LIKE LOWER(?)`).join(' AND ')
        const params = words.map(word => `%${word}%`)

        let sql = `
      SELECT repositoryId, path, content, language, 
             (LENGTH(content) - LENGTH(REPLACE(LOWER(content), LOWER(?), ''))) / LENGTH(?) as score
      FROM indexed_files 
      WHERE ${conditions}
    `
        params.push(query, query)

        if (repositoryIds && repositoryIds.length > 0) {
            sql += ' AND repositoryId IN (' + repositoryIds.map(() => '?').join(',') + ')'
            params.push(...repositoryIds)
        }

        sql += ' ORDER BY score DESC LIMIT 20'

        console.log(`SQL query:`, sql)
        console.log(`SQL params:`, params)

        try {
            const rows = await this.db.all(sql, params)
            console.log(`Database returned ${rows.length} rows`)
            return rows.map(row => ({
                repositoryId: row.repositoryId,
                path: row.path,
                content: row.content,
                language: row.language,
                score: Math.min(1.0, row.score || 0),
            }))
        } catch (error) {
            console.error('Database search error:', error)
            return []
        }
    }

    // Методы для работы с индексированными страницами документации
    async saveIndexedPage(documentationId: string, page: {
        url: string
        title: string
        content: string
        embedding?: string
    }): Promise<void> {
        if (!this.db) throw new Error('Database not initialized')

        await this.db.run(`
      INSERT OR REPLACE INTO indexed_pages 
      (documentationId, url, title, content, embedding)
      VALUES (?, ?, ?, ?, ?)
    `, [
            documentationId, page.url, page.title, page.content, page.embedding
        ])
    }

    async getIndexedPages(documentationId: string): Promise<Array<{
        url: string
        title: string
        content: string
        embedding?: string
    }>> {
        if (!this.db) throw new Error('Database not initialized')

        const rows = await this.db.all(
            'SELECT url, title, content, embedding FROM indexed_pages WHERE documentationId = ?',
            [documentationId]
        )
        return rows
    }

    async searchIndexedPages(query: string, documentationIds?: string[]): Promise<Array<{
        documentationId: string
        url: string
        title: string
        content: string
        score: number
    }>> {
        if (!this.db) throw new Error('Database not initialized')

        const whereClause = documentationIds && documentationIds.length > 0
            ? `WHERE documentationId IN (${documentationIds.map(() => '?').join(',')})`
            : ''

        const queryParams = documentationIds || []

        const results = await this.db.all(`
            SELECT 
                documentationId,
                url,
                title,
                content,
                CASE 
                    WHEN content LIKE ? THEN 100
                    WHEN title LIKE ? THEN 80
                    WHEN content LIKE ? THEN 60
                    ELSE 0
                END as score
            FROM indexed_pages
            ${whereClause}
            WHERE (
                content LIKE ? OR 
                title LIKE ? OR 
                content LIKE ?
            )
            ORDER BY score DESC
            LIMIT 50
        `, [`%${query}%`, `%${query}%`, `%${query}%`, ...queryParams, `%${query}%`, `%${query}%`, `%${query}%`])

        return results.map(row => ({
            documentationId: row.documentationId,
            url: row.url,
            title: row.title,
            content: row.content,
            score: row.score
        }))
    }

    async getRecentIndexedFiles(limit: number = 20): Promise<Array<{
        repository: string
        path: string
        language: string
        size: number
        timestamp: string
    }>> {
        if (!this.db) throw new Error('Database not initialized')

        const results = await this.db.all(`
            SELECT 
                repositoryId as repository,
                path,
                language,
                size,
                lastIndexed as timestamp
            FROM indexed_files
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limit])

        return results.map(row => ({
            repository: row.repository,
            path: row.path,
            language: row.language,
            size: row.size,
            timestamp: row.timestamp
        }))
    }

    async close(): Promise<void> {
        if (this.db) {
            await this.db.close()
            this.db = null
        }
    }
} 
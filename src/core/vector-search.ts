import { QdrantClient } from '@qdrant/js-client-rest'
import * as dotenv from 'dotenv'

// Динамический импорт OpenRouter для избежания проблем с типами
let OpenRouter: any = null
try {
    OpenRouter = require('openrouter-client')
} catch (error) {
    console.warn('OpenRouter client not available')
}

export interface VectorSearchResult {
    id: string
    score: number
    payload: {
        path?: string
        url?: string
        title?: string
        content: string
        language?: string
        repository?: string
        documentation?: string
        type: 'file' | 'page'
    }
}

export interface EmbeddingResult {
    embedding: number[]
    content: string
}

export class VectorSearchEngine {
    private qdrant: QdrantClient
    private openrouter: any = null
    private isInitialized = false

    constructor() {
        const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
        this.qdrant = new QdrantClient({ url: qdrantUrl })

        // OpenRouter временно отключен
        // const apiKey = process.env.OPENROUTER_API_KEY
        // if (apiKey && OpenRouter) {
        //     try {
        //         this.openrouter = new OpenRouter({
        //             apiKey,
        //             baseURL: 'https://openrouter.ai/api/v1',
        //         })
        //     } catch (error) {
        //         console.warn('Failed to initialize OpenRouter client:', error)
        //     }
        // }
    }

    async initialize(): Promise<void> {
        try {
            // Проверяем подключение к Qdrant
            await this.qdrant.getCollections()
            console.log('✅ Qdrant connection established')

            // Создаем коллекции если их нет
            await this.createCollections()

            this.isInitialized = true
            console.log('✅ Vector search engine initialized')
        } catch (error) {
            console.error('❌ Failed to initialize vector search engine:', error)
            throw error
        }
    }

    private async createCollections(): Promise<void> {
        try {
            // Коллекция для файлов кода
            await this.qdrant.createCollection('files', {
                vectors: {
                    size: 1536, // OpenAI embedding size
                    distance: 'Cosine'
                }
            })
            console.log('✅ Created files collection')

            // Коллекция для страниц документации
            await this.qdrant.createCollection('pages', {
                vectors: {
                    size: 1536,
                    distance: 'Cosine'
                }
            })
            console.log('✅ Created pages collection')
        } catch (error) {
            // Коллекции уже существуют
            console.log('ℹ️ Collections already exist')
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Временное решение: используем простые эмбеддинги
        // В будущем можно подключить OpenRouter или другую модель

        // Создаем простой эмбеддинг на основе текста
        const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2)
        const embedding = new Array(1536).fill(0)

        // Простое хеширование слов в эмбеддинг
        words.forEach((word, index) => {
            const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const position = hash % 1536
            embedding[position] = Math.min(embedding[position] + 1, 10) // Ограничиваем значение
        })

        // Нормализуем эмбеддинг
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] = embedding[i] / magnitude
            }
        }

        return embedding
    }

    async indexFile(
        fileId: string,
        content: string,
        metadata: {
            path: string
            language: string
            repository: string
            size: number
            lines: number
        }
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Vector search engine not initialized')
        }

        try {
            // Генерируем embedding для содержимого файла
            const embedding = await this.generateEmbedding(content)

            // Сохраняем в Qdrant
            await this.qdrant.upsert('files', {
                points: [{
                    id: fileId,
                    vector: embedding,
                    payload: {
                        path: metadata.path,
                        content: content.substring(0, 1000), // Ограничиваем размер
                        language: metadata.language,
                        repository: metadata.repository,
                        size: metadata.size,
                        lines: metadata.lines,
                        type: 'file'
                    }
                }]
            })

            console.log(`✅ Indexed file: ${metadata.path}`)
        } catch (error) {
            console.error(`❌ Failed to index file ${metadata.path}:`, error)
            throw error
        }
    }

    async indexPage(
        pageId: string,
        content: string,
        metadata: {
            url: string
            title: string
            documentation: string
        }
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Vector search engine not initialized')
        }

        try {
            // Генерируем embedding для содержимого страницы
            const embedding = await this.generateEmbedding(content)

            // Сохраняем в Qdrant
            await this.qdrant.upsert('pages', {
                points: [{
                    id: pageId,
                    vector: embedding,
                    payload: {
                        url: metadata.url,
                        title: metadata.title,
                        content: content.substring(0, 1000), // Ограничиваем размер
                        documentation: metadata.documentation,
                        type: 'page'
                    }
                }]
            })

            console.log(`✅ Indexed page: ${metadata.title}`)
        } catch (error) {
            console.error(`❌ Failed to index page ${metadata.url}:`, error)
            throw error
        }
    }

    async searchFiles(
        query: string,
        options: {
            repositories?: string[]
            languages?: string[]
            limit?: number
            scoreThreshold?: number
        } = {}
    ): Promise<VectorSearchResult[]> {
        if (!this.isInitialized) {
            throw new Error('Vector search engine not initialized')
        }

        try {
            // Генерируем embedding для запроса
            const queryEmbedding = await this.generateEmbedding(query)

            // Строим фильтр
            const filter: any = {}
            if (options.repositories && options.repositories.length > 0) {
                filter.must = [
                    { key: 'repository', match: { any: options.repositories } }
                ]
            }
            if (options.languages && options.languages.length > 0) {
                if (!filter.must) filter.must = []
                filter.must.push({ key: 'language', match: { any: options.languages } })
            }

            // Выполняем поиск
            const results = await this.qdrant.search('files', {
                vector: queryEmbedding,
                limit: options.limit || 20,
                score_threshold: options.scoreThreshold || 0.7,
                filter: Object.keys(filter).length > 0 ? filter : undefined
            })

            return results.map(result => ({
                id: result.id as string,
                score: result.score,
                payload: result.payload as any
            }))
        } catch (error) {
            console.error('Error searching files:', error)
            return []
        }
    }

    async searchPages(
        query: string,
        options: {
            documentation?: string[]
            limit?: number
            scoreThreshold?: number
        } = {}
    ): Promise<VectorSearchResult[]> {
        if (!this.isInitialized) {
            throw new Error('Vector search engine not initialized')
        }

        try {
            // Генерируем embedding для запроса
            const queryEmbedding = await this.generateEmbedding(query)

            // Строим фильтр
            const filter: any = {}
            if (options.documentation && options.documentation.length > 0) {
                filter.must = [
                    { key: 'documentation', match: { any: options.documentation } }
                ]
            }

            // Выполняем поиск
            const results = await this.qdrant.search('pages', {
                vector: queryEmbedding,
                limit: options.limit || 20,
                score_threshold: options.scoreThreshold || 0.7,
                filter: Object.keys(filter).length > 0 ? filter : undefined
            })

            return results.map(result => ({
                id: result.id as string,
                score: result.score,
                payload: result.payload as any
            }))
        } catch (error) {
            console.error('Error searching pages:', error)
            return []
        }
    }

    async deleteFile(fileId: string): Promise<void> {
        try {
            await this.qdrant.delete('files', {
                points: [fileId]
            })
            console.log(`✅ Deleted file: ${fileId}`)
        } catch (error) {
            console.error(`❌ Failed to delete file ${fileId}:`, error)
        }
    }

    async deletePage(pageId: string): Promise<void> {
        try {
            await this.qdrant.delete('pages', {
                points: [pageId]
            })
            console.log(`✅ Deleted page: ${pageId}`)
        } catch (error) {
            console.error(`❌ Failed to delete page ${pageId}:`, error)
        }
    }

    async deleteRepository(repository: string): Promise<void> {
        try {
            await this.qdrant.delete('files', {
                filter: {
                    must: [
                        { key: 'repository', match: { value: repository } }
                    ]
                }
            })
            console.log(`✅ Deleted repository: ${repository}`)
        } catch (error) {
            console.error(`❌ Failed to delete repository ${repository}:`, error)
        }
    }

    async deleteDocumentation(documentation: string): Promise<void> {
        try {
            await this.qdrant.delete('pages', {
                filter: {
                    must: [
                        { key: 'documentation', match: { value: documentation } }
                    ]
                }
            })
            console.log(`✅ Deleted documentation: ${documentation}`)
        } catch (error) {
            console.error(`❌ Failed to delete documentation ${documentation}:`, error)
        }
    }

    async getStats(): Promise<{
        files: number
        pages: number
    }> {
        try {
            const filesCollection = await this.qdrant.getCollection('files')
            const pagesCollection = await this.qdrant.getCollection('pages')

            return {
                files: filesCollection.points_count || 0,
                pages: pagesCollection.points_count || 0
            }
        } catch (error) {
            console.error('Error getting stats:', error)
            return { files: 0, pages: 0 }
        }
    }
} 
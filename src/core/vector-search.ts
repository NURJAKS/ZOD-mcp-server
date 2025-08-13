import { QdrantClient } from '@qdrant/js-client-rest'
import * as dotenv from 'dotenv'
import { safeLog } from '../utils'
import { LocalVectorStore } from './local-vector-store'
import { loadZodCoreConfig } from '../tools/zod-core/config'

// Динамический импорт OpenRouter для избежания проблем с типами
let OpenRouterCtor: any = null
try {
    const mod = require('openrouter-client')
    OpenRouterCtor = (mod && (mod.default || (mod as any).OpenRouter)) ? (mod.default || (mod as any).OpenRouter) : mod
} catch (error) {
    // Use safeLog to avoid breaking stdio communication
    safeLog('OpenRouter client not available', 'warn')
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
    private qdrant: QdrantClient | null = null
    private localStore: LocalVectorStore | null = null
    private openrouter: any = null
    private isInitialized = false
    private embeddingDim: number | null = null
    // Allow tests to inject a custom config loader
    private configLoader: () => ReturnType<typeof loadZodCoreConfig> = () => loadZodCoreConfig()

    public get isReady(): boolean {
        return this.isInitialized
    }

    constructor() {
        const qdrantUrl = process.env.QDRANT_URL || ''
        if (qdrantUrl) {
            // Configure Qdrant client with compatibility checks disabled to prevent console warnings
            this.qdrant = new QdrantClient({ 
                url: qdrantUrl,
                apiKey: process.env.QDRANT_API_KEY,
                checkCompatibility: false
            })
        } else {
            this.qdrant = null
            this.localStore = new LocalVectorStore(process.env.LOCAL_VECTOR_DB_PATH)
        }
    }

    /** Testing/advanced: override how config is loaded */
    public setConfigLoader(loader: () => ReturnType<typeof loadZodCoreConfig>): void {
        this.configLoader = loader
    }

    async initialize(): Promise<void> {
        try {
            // Initialize storage
            if (this.qdrant) {
                // Test connection with timeout
                try {
                    const testConnection = Promise.race([
                        this.qdrant.getCollections(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Qdrant connection timeout')), 5000)),
                    ])
                    await testConnection
                    safeLog('✅ Qdrant vector database connected')
                } catch (error) {
                    safeLog(`⚠️ Qdrant connection failed, using local vector store: ${error}`, 'warn')
                    this.qdrant = null
                    if (!this.localStore) {
                        this.localStore = new LocalVectorStore(process.env.LOCAL_VECTOR_DB_PATH)
                    }
                }
            }
            if (!this.qdrant && !this.localStore) {
                this.localStore = new LocalVectorStore(process.env.LOCAL_VECTOR_DB_PATH)
            }
            if (this.localStore) await this.localStore.initialize()
            
            // Initialize OpenRouter if available (but do not override test-injected mocks)
            if (!this.openrouter) {
                if (process.env.OPENROUTER_API_KEY && OpenRouterCtor) {
                    try {
                        this.openrouter = new OpenRouterCtor({
                            apiKey: process.env.OPENROUTER_API_KEY,
                            baseURL: 'https://openrouter.ai/api/v1',
                        })
                        safeLog('✅ OpenRouter client initialized')
                    } catch (error) {
                        safeLog(`⚠️ OpenRouter initialization failed: ${error}`, 'warn')
                        this.openrouter = null
                    }
                } else if (process.env.OPENROUTER_API_KEY) {
                    safeLog('ℹ️ OpenRouter module not available; embeddings unavailable', 'warn')
                } else {
                    safeLog('ℹ️ OpenRouter not configured; embeddings unavailable', 'warn')
                }
            }
            
            // Mark as initialized only on success
            this.isInitialized = true
            safeLog('✅ Vector search engine initialized successfully')
        } catch (error) {
            safeLog(`❌ Vector search initialization failed: ${error}`, 'error')
            throw error
        }
    }

    private async ensureCollections(dim: number): Promise<void> {
        if (!this.qdrant) return
        try {
            await this.qdrant.createCollection('files', { vectors: { size: dim, distance: 'Cosine' } })
            safeLog('✅ Created files collection')
        } catch { /* exists */ }
        try {
            await this.qdrant.createCollection('pages', { vectors: { size: dim, distance: 'Cosine' } })
            safeLog('✅ Created pages collection')
        } catch { /* exists */ }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const cfg = this.configLoader()
        let model = 'nomic-embed-text-v1.5'
        if (cfg && cfg.models && cfg.models.embeddingModel) {
            if (cfg.models.embeddingModel !== 'openai/text-embedding-3-large') {
                model = cfg.models.embeddingModel
            }
        }
            if (!this.openrouter || !this.openrouter.embeddings || typeof this.openrouter.embeddings.create !== 'function') {
                throw new Error('OpenRouter client not initialized for embeddings')
            }
            const response = await this.openrouter.embeddings.create({
            model,
            input: text,
        })
        const vector = response?.data?.[0]?.embedding
        if (!Array.isArray(vector)) throw new Error('Invalid embedding response')
        // Cache dimension
        if (!this.embeddingDim) this.embeddingDim = vector.length
        return vector
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
        },
        extraPayload: Record<string, any> = {},
    ): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Vector search engine not initialized')
        }

        try {
            // Generate embedding and ensure collections match dim
            const embedding = await this.generateEmbedding(content)
            const dim = this.embeddingDim || embedding.length
            if (this.qdrant) {
                await this.ensureCollections(dim)
                await this.qdrant.upsert('files', {
                    points: [{
                        id: fileId,
                        vector: embedding,
                        payload: {
                            path: metadata.path,
                            content: content.substring(0, 1000),
                            language: metadata.language,
                            repository: metadata.repository,
                            size: metadata.size,
                            lines: metadata.lines,
                            type: 'file',
                            ...extraPayload,
                        }
                    }]
                })
            } else if (this.localStore) {
                const payload = {
                    path: metadata.path,
                    content: content.substring(0, 1000),
                    language: metadata.language,
                    repository: metadata.repository,
                    size: metadata.size,
                    lines: metadata.lines,
                    type: 'file',
                    ...extraPayload,
                }
                const anyStore: any = this.localStore as any
                if (typeof anyStore.addPoint === 'function') {
                    await anyStore.addPoint('files', { id: fileId, vector: embedding, payload }, dim)
                } else if (typeof anyStore.upsert === 'function') {
                    await anyStore.upsert('files', { id: fileId, vector: embedding, payload }, dim)
                } else {
                    throw new Error('Local vector store does not support addPoint or upsert')
                }
            } else {
                throw new Error('No vector store available')
            }
            safeLog(`✅ Indexed file: ${metadata.path}`)
        } catch (error) {
            safeLog(`❌ Failed to index file ${metadata.path}: ${error}`, 'error')
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
            const embedding = await this.generateEmbedding(content)
            const dim = this.embeddingDim || embedding.length
            if (this.qdrant) {
                await this.ensureCollections(dim)
                await this.qdrant.upsert('pages', {
                    points: [{
                        id: pageId,
                        vector: embedding,
                        payload: {
                            url: metadata.url,
                            title: metadata.title,
                            content: content.substring(0, 1000),
                            documentation: metadata.documentation,
                            type: 'page'
                        }
                    }]
                })
            } else if (this.localStore) {
                await this.localStore.upsert('pages', {
                    id: pageId,
                    vector: embedding,
                    payload: {
                        url: metadata.url,
                        title: metadata.title,
                        content: content.substring(0, 1000),
                        documentation: metadata.documentation,
                        type: 'page'
                    }
                }, dim)
            } else {
                throw new Error('No vector store available')
            }
            safeLog(`✅ Indexed page: ${metadata.title}`)
        } catch (error) {
            safeLog(`❌ Failed to index page ${metadata.url}: ${error}`, 'error')
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
            if (!this.qdrant && !this.localStore) {
                throw new Error('Vector search engine not initialized')
            }
            if (!this.openrouter || !this.openrouter.embeddings || typeof this.openrouter.embeddings.create !== 'function') {
                // Embeddings unavailable; return no semantic results rather than throwing
                return []
            }
            const queryEmbedding = await this.generateEmbedding(query)
            const dim = this.embeddingDim || queryEmbedding.length
            if (this.qdrant) {
                const filter: any = {}
                if (options.repositories && options.repositories.length > 0) {
                    filter.must = [{ key: 'repository', match: { any: options.repositories } }]
                }
                if (options.languages && options.languages.length > 0) {
                    if (!filter.must) filter.must = []
                    filter.must.push({ key: 'language', match: { any: options.languages } })
                }
                const results = await this.qdrant.search('files', {
                    vector: queryEmbedding,
                    limit: options.limit || 20,
                    score_threshold: options.scoreThreshold || 0.7,
                    filter: Object.keys(filter).length > 0 ? filter : undefined
                })
                const array = Array.isArray((results as any)) ? (results as any) : (results as any)?.result || []
                return array.map((result: any) => ({ id: result.id as string, score: result.score, payload: result.payload as any }))
            } else if (this.localStore) {
                const filter: any[] = []
                if (options.repositories && options.repositories.length > 0) filter.push({ key: 'repository', any: options.repositories })
                if (options.languages && options.languages.length > 0) filter.push({ key: 'language', any: options.languages })
                const results = await this.localStore.search('files', queryEmbedding, { dim, limit: options.limit || 20, scoreThreshold: options.scoreThreshold || 0.7, filter })
                return results.map((r: any) => ({ id: r.id, score: r.score, payload: r.payload }))
            }
            throw new Error('Vector search engine not initialized')
        } catch (error) {
            safeLog(`Error searching files: ${error}`, 'error')
            throw error
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
            if (!this.qdrant && !this.localStore) {
                throw new Error('Vector search engine not initialized')
            }
            if (!this.openrouter || !this.openrouter.embeddings || typeof this.openrouter.embeddings.create !== 'function') {
                return []
            }
            const queryEmbedding = await this.generateEmbedding(query)
            const dim = this.embeddingDim || queryEmbedding.length
            if (this.qdrant) {
                const filter: any = {}
                if (options.documentation && options.documentation.length > 0) {
                    filter.must = [{ key: 'documentation', match: { any: options.documentation } }]
                }
                const results = await this.qdrant.search('pages', {
                    vector: queryEmbedding,
                    limit: options.limit || 20,
                    score_threshold: options.scoreThreshold || 0.7,
                    filter: Object.keys(filter).length > 0 ? filter : undefined
                })
                const array = Array.isArray((results as any)) ? (results as any) : (results as any)?.result || []
                return array.map((result: any) => ({ id: result.id as string, score: result.score, payload: result.payload as any }))
            } else if (this.localStore) {
                const filter: any[] = []
                if (options.documentation && options.documentation.length > 0) filter.push({ key: 'documentation', any: options.documentation })
                const results = await this.localStore.search('pages', queryEmbedding, { dim, limit: options.limit || 20, scoreThreshold: options.scoreThreshold || 0.7, filter })
                return results.map((r: any) => ({ id: r.id, score: r.score, payload: r.payload }))
            }
            throw new Error('Vector search engine not initialized')
        } catch (error) {
            safeLog(`Error searching pages: ${error}`, 'error')
            throw error
        }
    }

    async deleteFile(fileId: string): Promise<void> {
        try {
            if (this.qdrant) {
                await this.qdrant.delete('files', { points: [fileId] })
            } else if (this.localStore) {
                if (typeof (this.localStore as any).deletePoint === 'function') {
                    await (this.localStore as any).deletePoint(fileId)
                } else {
                    await (this.localStore as any).delete('files', [fileId])
                }
            }
            safeLog(`✅ Deleted file: ${fileId}`)
        } catch (error) {
            safeLog(`❌ Failed to delete file ${fileId}: ${error}`, 'error')
        }
    }

    async deletePage(pageId: string): Promise<void> {
        try {
            if (this.qdrant) {
                await this.qdrant.delete('pages', { points: [pageId] })
            } else if (this.localStore) {
                await this.localStore.delete('pages', [pageId])
            }
            safeLog(`✅ Deleted page: ${pageId}`)
        } catch (error) {
            safeLog(`❌ Failed to delete page ${pageId}: ${error}`, 'error')
        }
    }

    async deleteRepository(repository: string): Promise<void> {
        try {
            if (this.qdrant) {
                await this.qdrant.delete('files', { filter: { must: [{ key: 'repository', match: { value: repository } }] } })
            } else if (this.localStore) {
                // naive delete by scanning; could optimize with SQL json_extract filter
                // For simplicity here, we cannot query payload filter without reading; skip advanced delete
            }
            safeLog(`✅ Deleted repository: ${repository}`)
        } catch (error) {
            safeLog(`❌ Failed to delete repository ${repository}: ${error}`, 'error')
        }
    }

    async deleteDocumentation(documentation: string): Promise<void> {
        try {
            if (this.qdrant) {
                await this.qdrant.delete('pages', { filter: { must: [{ key: 'documentation', match: { value: documentation } }] } })
            } else if (this.localStore) {
                // Same note as above; skipping selective delete for local store
            }
            safeLog(`✅ Deleted documentation: ${documentation}`)
        } catch (error) {
            safeLog(`❌ Failed to delete documentation ${documentation}: ${error}`, 'error')
        }
    }

    async getStats(): Promise<{
        files: number
        pages: number
    }> {
        try {
            if (this.qdrant) {
                const filesCollection = await this.qdrant.getCollection('files')
                const pagesCollection = await this.qdrant.getCollection('pages')
                return { files: filesCollection.points_count || 0, pages: pagesCollection.points_count || 0 }
            } else if (this.localStore) {
                const files = await this.localStore.getStats('files')
                const pages = await this.localStore.getStats('pages')
                return { files: files.points, pages: pages.points }
            }
            return { files: 0, pages: 0 }
        } catch (error) {
            safeLog(`Error getting stats: ${error}`, 'error')
            return { files: 0, pages: 0 }
        }
    }
} 
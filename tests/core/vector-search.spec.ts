/**
 * @fileoverview Comprehensive tests for the VectorSearchEngine component
 * @description Tests vector search functionality, embeddings, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VectorSearchEngine } from '../../src/core/vector-search'

// Mock dependencies
vi.mock('../../src/core/local-vector-store', () => ({
  LocalVectorStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue([]),
    addPoint: vi.fn().mockResolvedValue(true),
    deletePoint: vi.fn().mockResolvedValue(true),
  }))
}))

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    getCollections: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue({ result: [] }),
    delete: vi.fn().mockResolvedValue(true),
  }))
}))

vi.mock('openrouter-client', () => ({
  OpenRouter: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      }),
    },
  }))
}))

describe('VectorSearchEngine', () => {
  let vectorEngine: VectorSearchEngine
  let mockLocalStore: any
  let mockQdrant: any
  let mockOpenRouter: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create mock instances
    mockLocalStore = {
      initialize: vi.fn().mockResolvedValue(true),
      search: vi.fn().mockResolvedValue([]),
      addPoint: vi.fn().mockResolvedValue(true),
      deletePoint: vi.fn().mockResolvedValue(true),
    }
    
    mockQdrant = {
      getCollections: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(true),
      search: vi.fn().mockResolvedValue({ result: [] }),
      delete: vi.fn().mockResolvedValue(true),
    }
    
    mockOpenRouter = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }]
        }),
      },
    }

    // Ensure OpenRouter can initialize
    process.env.OPENROUTER_API_KEY = 'test-key'
    
    // Create vector engine instance
    vectorEngine = new VectorSearchEngine()
    
    // Mock the internal properties
    Object.defineProperty(vectorEngine, 'localStore', {
      value: mockLocalStore,
      writable: true
    })
    
    Object.defineProperty(vectorEngine, 'qdrant', {
      value: mockQdrant,
      writable: true
    })
    
    Object.defineProperty(vectorEngine, 'openrouter', {
      value: mockOpenRouter,
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with Qdrant when URL is provided', async () => {
      // Set environment variable
      process.env.QDRANT_URL = 'http://localhost:6333'
      process.env.QDRANT_API_KEY = 'test-key'
      
      // Mock successful connection
      mockQdrant.getCollections.mockResolvedValue([])
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
      expect(mockQdrant.getCollections).toHaveBeenCalled()
    })

    it('should fallback to local vector store when Qdrant fails', async () => {
      // Set environment variable
      process.env.QDRANT_URL = 'http://localhost:6333'
      
      // Mock failed connection
      mockQdrant.getCollections.mockRejectedValue(new Error('Connection failed'))
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
      expect(mockLocalStore.initialize).toHaveBeenCalled()
    })

    it('should use local vector store when no Qdrant URL', async () => {
      // Clear environment variable
      delete process.env.QDRANT_URL
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
      expect(mockLocalStore.initialize).toHaveBeenCalled()
    })

    it('should handle initialization timeout gracefully', async () => {
      // Set environment variable
      process.env.QDRANT_URL = 'http://localhost:6333'
      
      // Mock slow connection
      mockQdrant.getCollections.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      )
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
      expect(mockLocalStore.initialize).toHaveBeenCalled()
    })
  })

  describe('OpenRouter Integration', () => {
    it('should initialize OpenRouter when API key is available', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key'
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
    })

    it('should handle OpenRouter initialization failure gracefully', async () => {
      process.env.OPENROUTER_API_KEY = 'invalid-key'
      
      await vectorEngine.initialize()
      
      expect(vectorEngine.isReady).toBe(true)
    })
  })

  describe('Embedding Generation', () => {
    beforeEach(async () => {
      await vectorEngine.initialize()
    })

    it('should generate embeddings successfully', async () => {
      const testText = 'Test text for embedding'
      
      const embedding = await vectorEngine.generateEmbedding(testText)
      
      expect(embedding).toBeInstanceOf(Array)
      expect(embedding.length).toBe(1536)
      expect(mockOpenRouter.embeddings.create).toHaveBeenCalledWith({
        model: 'nomic-embed-text-v1.5',
        input: testText,
      })
    })

    it('should use custom embedding model when specified', async () => {
      const testText = 'Custom model test'
      
      // Mock config to return custom model
      vi.doMock('../../src/tools/zod-core/config', () => ({
        loadZodCoreConfig: () => ({
          models: { embeddingModel: 'custom/embedding-model' },
        }),
      }))
      
      mockOpenRouter.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      })
      
      await vectorEngine.generateEmbedding(testText)
      
      expect(mockOpenRouter.embeddings.create).toHaveBeenCalledWith({
        model: 'custom/embedding-model',
        input: testText,
      })
    })

    it('should throw error when OpenRouter is not initialized', async () => {
      // Remove OpenRouter
      Object.defineProperty(vectorEngine, 'openrouter', {
        value: null,
        writable: true
      })
      
      await expect(
        vectorEngine.generateEmbedding('test text')
      ).rejects.toThrow('OpenRouter client not initialized for embeddings')
    })

    it('should handle embedding API errors gracefully', async () => {
      mockOpenRouter.embeddings.create.mockRejectedValue(new Error('API error'))
      
      await expect(
        vectorEngine.generateEmbedding('test text')
      ).rejects.toThrow('API error')
    })

    it('should handle malformed API responses', async () => {
      // Mock response without embedding data
      mockOpenRouter.embeddings.create.mockResolvedValue({
        data: [],
      })
      
      await expect(
        vectorEngine.generateEmbedding('test text')
      ).rejects.toThrow('Invalid embedding response')
    })
  })

  describe('Vector Search', () => {
    beforeEach(async () => {
      await vectorEngine.initialize()
    })

    it('should search Qdrant when available', async () => {
      // Set up Qdrant
      process.env.QDRANT_URL = 'http://localhost:6333'
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: mockQdrant,
        writable: true
      })
      
      const mockResults = [
        { id: '1', score: 0.95, payload: { content: 'result 1' } },
        { id: '2', score: 0.87, payload: { content: 'result 2' } },
      ]
      
      mockQdrant.search.mockResolvedValue({
        result: mockResults,
      })
      
      const results = await vectorEngine.searchFiles('test query', { limit: 10 })
      
      expect(results).toHaveLength(2)
      expect(results[0].score).toBe(0.95)
      expect(mockQdrant.search).toHaveBeenCalled()
    })

    it('should fallback to local search when Qdrant unavailable', async () => {
      // Ensure Qdrant is null
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: null,
        writable: true
      })
      
      const mockResults = [
        { id: '1', score: 0.9, payload: { content: 'local result' } },
      ]
      
      mockLocalStore.search.mockResolvedValue(mockResults)
      
      const results = await vectorEngine.searchFiles('test query', { limit: 5 })
      
      expect(results).toHaveLength(1)
      expect(mockLocalStore.search).toHaveBeenCalled()
    })

    it('should throw error when neither Qdrant nor local store available', async () => {
      // Remove both stores
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: null,
        writable: true
      })
      Object.defineProperty(vectorEngine, 'localStore', {
        value: null,
        writable: true
      })
      
      await expect(
        vectorEngine.searchFiles('test query', { limit: 5 })
      ).rejects.toThrow('Vector search engine not initialized')
    })
  })

  describe('File Indexing', () => {
    beforeEach(async () => {
      await vectorEngine.initialize()
    })

    it('should index file in Qdrant when available', async () => {
      const fileId = 'test-file'
      const content = 'Test file content'
      const metadata = { 
        path: 'src/test.ts', 
        language: 'typescript', 
        repository: 'test-repo', 
        size: 100, 
        lines: 10 
      }
      
      // Mock embedding generation
      mockOpenRouter.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      })
      
      await vectorEngine.indexFile(fileId, content, metadata)
      
      expect(mockQdrant.upsert).toHaveBeenCalled()
    })

    it('should index file in local store when Qdrant unavailable', async () => {
      const fileId = 'test-file-2'
      const content = 'Test file content 2'
      const metadata = { 
        path: 'src/test.js', 
        language: 'javascript', 
        repository: 'test-repo', 
        size: 150, 
        lines: 15 
      }
      
      // Remove Qdrant
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: null,
        writable: true
      })
      
      // Mock embedding generation
      mockOpenRouter.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      })
      
      await vectorEngine.indexFile(fileId, content, metadata)
      
      expect(mockLocalStore.addPoint).toHaveBeenCalled()
    })

    it('should handle indexing errors gracefully', async () => {
      const fileId = 'test-file-3'
      const content = 'Test file content 3'
      const metadata = { 
        path: 'src/test.py', 
        language: 'python', 
        repository: 'test-repo', 
        size: 200, 
        lines: 20 
      }
      
      // Remove Qdrant
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: null,
        writable: true
      })
      
      // Mock local store error
      mockLocalStore.addPoint.mockRejectedValue(new Error('Indexing failed'))
      
      await expect(
        vectorEngine.indexFile(fileId, content, metadata)
      ).rejects.toThrow('Indexing failed')
    })
  })

  describe('File Deletion', () => {
    beforeEach(async () => {
      await vectorEngine.initialize()
    })

    it('should delete file from Qdrant when available', async () => {
      const fileId = 'test-file-1'
      
      await vectorEngine.deleteFile(fileId)
      
      expect(mockQdrant.delete).toHaveBeenCalledWith('files', {
        points: [fileId]
      })
    })

    it('should delete file from local store when Qdrant unavailable', async () => {
      const fileId = 'test-file-2'
      
      // Remove Qdrant
      Object.defineProperty(vectorEngine, 'qdrant', {
        value: null,
        writable: true
      })
      
      await vectorEngine.deleteFile(fileId)
      
      expect(mockLocalStore.deletePoint).toHaveBeenCalledWith(fileId)
    })
  })

  describe('Error Handling', () => {
    it('should handle local store initialization errors', async () => {
      mockLocalStore.initialize.mockRejectedValue(new Error('Local store failed'))
      
      await expect(vectorEngine.initialize()).rejects.toThrow('Local store failed')
    })

    it('should handle search errors gracefully', async () => {
      mockLocalStore.search.mockRejectedValue(new Error('Search failed'))
      
      await expect(
        vectorEngine.searchFiles('test query', { limit: 5 })
      ).rejects.toThrow('Search failed')
    })
  })

  describe('Performance', () => {
    it('should handle large embedding dimensions efficiently', async () => {
      const largeText = 'x'.repeat(10000)
      
      const startTime = Date.now()
      await vectorEngine.generateEmbedding(largeText)
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent embedding requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        vectorEngine.generateEmbedding(`Request ${i}`)
      )
      
      const results = await Promise.all(requests)
      
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result).toBeInstanceOf(Array)
        expect(result.length).toBe(1536)
      })
    })
  })
}) 
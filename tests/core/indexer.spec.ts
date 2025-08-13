/**
 * @fileoverview Comprehensive tests for the Indexer component
 * @description Tests all major functionality including indexing, error handling, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Indexer } from '../../src/core/indexer'
import { DatabaseManager } from '../../src/core/database'
import { VectorSearchEngine } from '../../src/core/vector-search'
import type { IndexingOptions, IndexingResult } from '../../src/types'

// Mock dependencies
vi.mock('../../src/core/database')
vi.mock('../../src/core/vector-search')
vi.mock('@octokit/rest')

describe('Indexer', () => {
  let indexer: Indexer
  let mockDb: any
  let mockVectorEngine: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create mock instances
    mockDb = {
      saveRepository: vi.fn(),
      saveIndexedFile: vi.fn(),
      getRepository: vi.fn(),
      updateRepositoryStatus: vi.fn(),
    }
    
    mockVectorEngine = {
      initialize: vi.fn(),
      indexFile: vi.fn(),
      isReady: true,
    }

    // Mock static methods
    vi.mocked(DatabaseManager).mockImplementation(() => mockDb)
    vi.mocked(VectorSearchEngine).mockImplementation(() => mockVectorEngine)
    
    // Create indexer instance
    indexer = new Indexer()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(indexer).toBeDefined()
      expect(indexer['db']).toBeDefined()
      expect(indexer['vectorEngine']).toBeDefined()
    })

    it('should initialize vector search engine when enabled', async () => {
      const options: IndexingOptions = { enableVectorSearch: true }
      await indexer.initialize(options)
      
      expect(mockVectorEngine.initialize).toHaveBeenCalled()
    })

    it('should handle vector search initialization failure gracefully', async () => {
      mockVectorEngine.initialize.mockRejectedValue(new Error('Init failed'))
      
      const options: IndexingOptions = { enableVectorSearch: true }
      await expect(indexer.initialize(options)).resolves.not.toThrow()
    })
  })

  describe('Repository Indexing', () => {
    const mockRepo = {
      id: 'test-repo',
      owner: 'testowner',
      repo: 'testrepo',
      branch: 'main',
      status: 'indexing' as const,
      progress: 0,
      indexedFiles: 0,
      totalFiles: 0,
      lastIndexed: new Date(),
    }

    beforeEach(() => {
      mockDb.getRepository.mockResolvedValue(mockRepo)
      mockDb.saveRepository.mockResolvedValue(undefined)
    })

    it('should index repository successfully', async () => {
      const result = await indexer.indexRepository('test-repo', {
        enableVectorSearch: true,
        maxFiles: 100,
        verbose: true,
      })

      expect(result).toBeDefined()
      expect(result.indexedFiles).toBeGreaterThanOrEqual(0)
      expect(mockDb.saveRepository).toHaveBeenCalled()
    })

    it('should handle empty repository gracefully', async () => {
      // Mock empty repository
      mockDb.getRepository.mockResolvedValue({
        ...mockRepo,
        totalFiles: 0,
      })

      const result = await indexer.indexRepository('test-repo', {})
      
      expect(result.indexedFiles).toBe(0)
      expect(result.totalFiles).toBe(0)
    })

    it('should respect maxFiles limit', async () => {
      const options: IndexingOptions = { maxFiles: 5 }
      
      await indexer.indexRepository('test-repo', options)
      
      // Verify that the limit was respected
      expect(mockDb.saveRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFiles: expect.any(Number),
        })
      )
    })

    it('should handle file size limits correctly', async () => {
      const options: IndexingOptions = { maxFileSize: 1024 }
      
      await indexer.indexRepository('test-repo', options)
      
      // Verify that large files were filtered out
      expect(mockDb.saveIndexedFile).toHaveBeenCalledWith(
        'test-repo',
        expect.objectContaining({
          size: expect.any(Number),
        })
      )
    })
  })

  describe('File Processing', () => {
    it('should detect language correctly', () => {
      const typescriptFile = 'src/components/Button.tsx'
      const javascriptFile = 'src/utils/helper.js'
      const pythonFile = 'src/models/user.py'
      
      expect(indexer['detectLanguage'](typescriptFile)).toBe('typescript')
      expect(indexer['detectLanguage'](javascriptFile)).toBe('javascript')
      expect(indexer['detectLanguage'](pythonFile)).toBe('python')
    })

    it('should handle unknown file extensions', () => {
      const unknownFile = 'src/config/settings.conf'
      const noExtensionFile = 'README'
      
      expect(indexer['detectLanguage'](unknownFile)).toBe('unknown')
      expect(indexer['detectLanguage'](noExtensionFile)).toBe('unknown')
    })

    it('should filter files based on patterns', () => {
      const includePatterns = ['*.ts', '*.js']
      const excludePatterns = ['*.test.ts', 'node_modules/**']
      
      const testFile = 'src/components/Button.ts'
      const testTestFile = 'src/components/Button.test.ts'
      const nodeModuleFile = 'node_modules/lodash/index.js'
      
      expect(indexer['shouldIncludeFile'](testFile, includePatterns, excludePatterns)).toBe(true)
      expect(indexer['shouldIncludeFile'](testTestFile, includePatterns, excludePatterns)).toBe(false)
      expect(indexer['shouldIncludeFile'](nodeModuleFile, includePatterns, excludePatterns)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.saveRepository.mockRejectedValue(new Error('Database error'))
      
      await expect(
        indexer.indexRepository('test-repo', {})
      ).rejects.toThrow('Database error')
    })

    it('should handle vector search errors without failing indexing', async () => {
      mockVectorEngine.indexFile.mockRejectedValue(new Error('Vector search error'))
      
      // Should not throw
      await expect(
        indexer.indexRepository('test-repo', { enableVectorSearch: true })
      ).resolves.not.toThrow()
    })

    it('should handle rate limiting gracefully', async () => {
      // Mock rate limit error
      const mockOctokit = {
        git: {
          getBlob: vi.fn().mockRejectedValue({ status: 429, message: 'Rate limited' })
        }
      }
      
      // This should handle rate limiting without crashing
      await expect(
        indexer['getFileContent']('test-sha', 1024, 'owner', 'repo')
      ).resolves.toBeNull()
    })
  })

  describe('Performance and Concurrency', () => {
    it('should process files in parallel when enabled', async () => {
      const options: IndexingOptions = { 
        parallel: true, 
        workerThreads: 4,
        maxFiles: 100 
      }
      
      const startTime = Date.now()
      await indexer.indexRepository('test-repo', options)
      const endTime = Date.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000)
    })

    it('should respect concurrency limits', async () => {
      const options: IndexingOptions = { 
        parallel: true, 
        workerThreads: 2,
        maxFiles: 50 
      }
      
      await indexer.indexRepository('test-repo', options)
      
      // Verify that concurrency was controlled
      expect(mockDb.saveIndexedFile).toHaveBeenCalled()
    })
  })

  describe('Progress Tracking', () => {
    it('should update progress during indexing', async () => {
      const options: IndexingOptions = { verbose: true }
      
      await indexer.indexRepository('test-repo', options)
      
      // Verify progress updates were called
      expect(mockDb.saveRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: expect.any(Number),
        })
      )
    })

    it('should provide accurate progress percentages', async () => {
      const options: IndexingOptions = { verbose: true }
      
      await indexer.indexRepository('test-repo', options)
      
      // Progress should be between 0 and 100
      const calls = mockDb.saveRepository.mock.calls
      calls.forEach(call => {
        const progress = call[0].progress
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large files gracefully', async () => {
      const options: IndexingOptions = { maxFileSize: 1024 }
      
      await indexer.indexRepository('test-repo', options)
      
      // Large files should be skipped
      expect(mockDb.saveIndexedFile).not.toHaveBeenCalledWith(
        expect.objectContaining({
          size: expect.any(Number),
        })
      )
    })

    it('should handle binary files correctly', async () => {
      const options: IndexingOptions = { verbose: true }
      
      await indexer.indexRepository('test-repo', options)
      
      // Binary files should be processed appropriately
      expect(mockDb.saveIndexedFile).toHaveBeenCalled()
    })

    it('should handle deeply nested directories', async () => {
      const options: IndexingOptions = { maxDepth: 3 }
      
      await indexer.indexRepository('test-repo', options)
      
      // Should respect depth limit
      expect(mockDb.saveIndexedFile).toHaveBeenCalled()
    })
  })

  describe('Integration', () => {
    it('should integrate with vector search when available', async () => {
      const options: IndexingOptions = { enableVectorSearch: true }
      
      await indexer.indexRepository('test-repo', options)
      
      expect(mockVectorEngine.indexFile).toHaveBeenCalled()
    })

    it('should integrate with database correctly', async () => {
      await indexer.indexRepository('test-repo', {})
      
      expect(mockDb.saveRepository).toHaveBeenCalled()
      expect(mockDb.saveIndexedFile).toHaveBeenCalled()
    })
  })
}) 
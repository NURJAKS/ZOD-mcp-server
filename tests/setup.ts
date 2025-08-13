/**
 * @fileoverview Test setup and configuration
 * @description Global test configuration, mocks, and utilities
 */

import { vi } from 'vitest'
import { config } from 'dotenv'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Load test environment variables
config({ path: '.env.test' })

// Global test configuration
process.env.NODE_ENV = 'test'

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock process methods
process.exit = vi.fn() as any

// Avoid mocking node:fs and node:path for integration tests; rely on real FS to support chdir and temp projects

// Mock environment variables
process.env.OPENROUTER_API_KEY = 'test-key'
process.env.QDRANT_URL = 'http://localhost:6333'
process.env.QDRANT_API_KEY = 'test-qdrant-key'
process.env.MAX_FILE_SIZE = '1048576'
process.env.CONCURRENCY_LIMIT = '5'

// Global test utilities
global.testUtils = {
  createMockFile: (path: string, content: string, size: number = 1024) => ({
    path,
    content,
    size,
    language: 'typescript',
    lines: content.split('\n').length,
  }),
  
  createMockRepository: (id: string, owner: string, repo: string) => ({
    id,
    owner,
    repo,
    branch: 'main',
    status: 'indexing' as const,
    progress: 0,
    indexedFiles: 0,
    totalFiles: 0,
    lastIndexed: new Date(),
  }),
  
  createMockEmbedding: (dimensions: number = 1536) => 
    new Array(dimensions).fill(0).map(() => Math.random() - 0.5),
  
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockPerformance: () => {
    const mockPerformance = {
      now: vi.fn(() => Date.now()),
    }
    Object.defineProperty(global, 'performance', {
      value: mockPerformance,
      writable: true,
    })
    return mockPerformance
  },

  // Enhanced temporary project creation
  async createTempProject(structure: Record<string, string | Record<string, string>>) {
    const tempDir = await mkdtemp(join(tmpdir(), 'mcp-test-project-'))
    
    const createFiles = async (basePath: string, files: Record<string, string | Record<string, string>>) => {
      for (const [name, content] of Object.entries(files)) {
        const fullPath = join(basePath, name)
        
        if (typeof content === 'string') {
          // It's a file
          await writeFile(fullPath, content, 'utf8')
        } else {
          // It's a directory
          await mkdir(fullPath, { recursive: true })
          await createFiles(fullPath, content)
        }
      }
    }
    
    await createFiles(tempDir, structure)
    
    return {
      path: tempDir,
      cleanup: async () => {
        try {
          await rm(tempDir, { recursive: true, force: true })
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    }
  },

  // Mock database operations
  mockDatabase: {
    initialize: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    query: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ changes: 0 }),
  },

  // Mock vector search operations
  mockVectorSearch: {
    initialize: vi.fn().mockResolvedValue(true),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
    search: vi.fn().mockResolvedValue([]),
    indexFile: vi.fn().mockResolvedValue(true),
    deleteFile: vi.fn().mockResolvedValue(true),
  },
}

// Type declarations for global test utilities
declare global {
  var testUtils: {
    createMockFile: (path: string, content: string, size?: number) => any
    createMockRepository: (id: string, owner: string, repo: string) => any
    createMockEmbedding: (dimensions?: number) => number[]
    wait: (ms: number) => Promise<void>
    mockPerformance: () => any
    createTempProject: (structure: Record<string, string | Record<string, string>>) => Promise<{
      path: string
      cleanup: () => Promise<void>
    }>
    mockDatabase: {
      initialize: () => Promise<boolean>
      close: () => Promise<boolean>
      query: () => Promise<any[]>
      execute: () => Promise<{ changes: number }>
    }
    mockVectorSearch: {
      initialize: () => Promise<boolean>
      generateEmbedding: () => Promise<number[]>
      search: () => Promise<any[]>
      indexFile: () => Promise<boolean>
      deleteFile: () => Promise<boolean>
    }
  }
}

// Cleanup after all tests
afterAll(async () => {
  // Clean up any remaining temporary files
  if (global.testUtils?.mockDatabase?.close) {
    await global.testUtils.mockDatabase.close()
  }
})

// Global test timeout
beforeAll(() => {
  vi.setConfig({ testTimeout: 30000 })
}) 
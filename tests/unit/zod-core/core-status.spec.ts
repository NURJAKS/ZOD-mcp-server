import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoreStatusChecker } from '../../../src/tools/zod-core/core-status'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('CoreStatusChecker', () => {
  let statusChecker: CoreStatusChecker
  let tempProject: any

  beforeEach(async () => {
    // Create a test project using the new test utilities
    tempProject = await global.testUtils.createTempProject({
      'src': {
        'main.js': `
function hello() {
  console.log('Hello, World!')
  return true
}
`
      },
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      })
    })
    
    statusChecker = new CoreStatusChecker()
  })

  afterEach(async () => {
    // Clean up test project
    if (tempProject?.cleanup) {
      await tempProject.cleanup()
    }
  })

  describe('getSystemStatus', () => {
    it('should handle missing databases gracefully', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.index.exists).toBe(false)
      expect(status.analysis.exists).toBe(false)
      expect(status.search.exists).toBe(false)
      expect(status.fixes.exists).toBe(false)
    })

    it('should provide system resource information', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.memory).toBeDefined()
      expect(status.uptime).toBeDefined()
      expect(status.cpu).toBeDefined()
    })

    it('should detect database corruption', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.index.corrupted).toBe(false)
      expect(status.analysis.corrupted).toBe(false)
      expect(status.search.corrupted).toBe(false)
    })
  })

  describe('index status', () => {
    it('should detect when index exists', async () => {
      // Create a mock index database
      const mockDbPath = join(tmpdir(), `test_index_${Date.now()}.sqlite`)
      
      // Mock the database operations
      const originalQuery = global.testUtils.mockDatabase.query
      global.testUtils.mockDatabase.query = vi.fn().mockResolvedValue([
        { total_files: 10, languages: 'javascript,json' }
      ])

      try {
        const status = await statusChecker.getSystemStatus(tempProject.path)

        expect(status.index.exists).toBe(true)
        expect(status.index.totalFiles).toBe(10)
        expect(status.index.languages).toContain('javascript')
      } finally {
        global.testUtils.mockDatabase.query = originalQuery
      }
    })

    it('should provide index statistics', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.index.totalFiles).toBeDefined()
      expect(status.index.languages).toBeDefined()
      expect(status.index.lastUpdated).toBeDefined()
    })
  })

  describe('analysis status', () => {
    it('should detect when analysis exists', async () => {
      // Mock the database operations
      const originalQuery = global.testUtils.mockDatabase.query
      global.testUtils.mockDatabase.query = vi.fn().mockResolvedValue([
        { total_issues: 5, severity: 'medium' }
      ])

      try {
        const status = await statusChecker.getSystemStatus(tempProject.path)

        expect(status.analysis.exists).toBe(true)
        expect(status.analysis.totalIssues).toBe(5)
        expect(status.analysis.severity).toBe('medium')
      } finally {
        global.testUtils.mockDatabase.query = originalQuery
      }
    })

    it('should provide analysis statistics', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.analysis.totalIssues).toBeDefined()
      expect(status.analysis.severity).toBeDefined()
      expect(status.analysis.lastAnalyzed).toBeDefined()
    })
  })

  describe('search status', () => {
    it('should detect when search index exists', async () => {
      // Mock the database operations
      const originalQuery = global.testUtils.mockDatabase.query
      global.testUtils.mockDatabase.query = vi.fn().mockResolvedValue([
        { total_documents: 15, last_indexed: new Date().toISOString() }
      ])

      try {
        const status = await statusChecker.getSystemStatus(tempProject.path)

        expect(status.search.exists).toBe(true)
        expect(status.search.totalDocuments).toBe(15)
        expect(status.search.lastIndexed).toBeDefined()
      } finally {
        global.testUtils.mockDatabase.query = originalQuery
      }
    })

    it('should provide search statistics', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.search.totalDocuments).toBeDefined()
      expect(status.search.lastIndexed).toBeDefined()
      expect(status.search.indexSize).toBeDefined()
    })
  })

  describe('fixes status', () => {
    it('should detect when fixes database exists', async () => {
      // Mock the database operations
      const originalQuery = global.testUtils.mockDatabase.query
      global.testUtils.mockDatabase.query = vi.fn().mockResolvedValue([
        { total_fixes: 3, last_applied: new Date().toISOString() }
      ])

      try {
        const status = await statusChecker.getSystemStatus(tempProject.path)

        expect(status.fixes.exists).toBe(true)
        expect(status.fixes.totalFixes).toBe(3)
        expect(status.fixes.lastApplied).toBeDefined()
      } finally {
        global.testUtils.mockDatabase.query = originalQuery
      }
    })

    it('should provide fixes statistics', async () => {
      const status = await statusChecker.getSystemStatus(tempProject.path)

      expect(status.fixes.totalFixes).toBeDefined()
      expect(status.fixes.lastApplied).toBeDefined()
      expect(status.fixes.successRate).toBeDefined()
    })
  })

  describe('health check', () => {
    it('should perform comprehensive health check', async () => {
      const health = await statusChecker.performHealthCheck(tempProject.path)

      expect(health.overall).toBeDefined()
      expect(health.components).toBeDefined()
      expect(health.recommendations).toBeDefined()
    })

    it('should identify performance issues', async () => {
      const health = await statusChecker.performHealthCheck(tempProject.path)

      expect(health.performance).toBeDefined()
      expect(health.performance.databaseSize).toBeDefined()
      expect(health.performance.queryTime).toBeDefined()
    })
  })
}) 
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoreSearcher } from '../../../src/tools/zod-core/core-search'
import { join } from 'node:path'

describe('CoreSearcher', () => {
  let searcher: CoreSearcher
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

export function greet(name) {
  return \`Hello, \${name}!\`
}
`,
        'utils.js': `
export function add(a, b) {
  return a + b
}

export function multiply(a, b) {
  return a * b
}
`
      },
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      })
    })
    
    searcher = new CoreSearcher()
  })

  afterEach(async () => {
    // Clean up test project
    if (tempProject?.cleanup) {
      await tempProject.cleanup()
    }
  })

  describe('buildSearchIndex', () => {
    it('should build search index successfully', async () => {
      const result = await searcher.buildSearchIndex(tempProject.path)

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBeGreaterThan(0)
    })

    it('should handle empty projects', async () => {
      const emptyProject = await global.testUtils.createTempProject({})
      
      const result = await searcher.buildSearchIndex(emptyProject.path)

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBe(0)
      
      await emptyProject.cleanup()
    })

    it('should respect file filters', async () => {
      const result = await searcher.buildSearchIndex(tempProject.path, {
        includePatterns: ['src/**/*.js'],
        excludePatterns: ['**/*.json']
      })

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBeGreaterThan(0)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await searcher.buildSearchIndex(tempProject.path)
    })

    it('should perform exact search', async () => {
      const results = await searcher.search({
        query: 'hello',
        type: 'exact'
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].match).toContain('hello')
      expect(results[0].type).toBe('exact')
    })

    it('should perform case-insensitive search by default', async () => {
      const results = await searcher.search({
        query: 'HELLO'
      })

      expect(results.length).toBeGreaterThan(0)
    })

    it('should filter by file', async () => {
      const results = await searcher.search({
        query: 'console',
        file: 'main.js'
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.file.includes('main.js'))).toBe(true)
    })

    it('should filter by language', async () => {
      const results = await searcher.search({
        query: 'console',
        language: 'javascript'
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.language === 'javascript')).toBe(true)
    })

    it('should provide context around matches', async () => {
      const results = await searcher.search({
        query: 'hello',
        includeContext: true
      })

      expect(results[0].context).toBeDefined()
      expect(results[0].context.length).toBeGreaterThan(0)
    })

    it('should calculate relevance scores', async () => {
      const results = await searcher.search({
        query: 'hello',
        includeScores: true
      })

      expect(results[0].score).toBeGreaterThan(0)
      expect(results[0].score).toBeLessThanOrEqual(1)
    })

    it('should handle semantic search', async () => {
      const results = await searcher.search({
        query: 'greeting',
        type: 'semantic'
      })

      // Semantic search should find 'hello' function even though 'greeting' isn't in the code
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle structural search', async () => {
      const results = await searcher.search({
        query: 'function',
        type: 'structural'
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('ensureIndex', () => {
    it('should build index if it does not exist', async () => {
      // Should be able to search after ensuring index
      const results = await searcher.search({ query: 'console' })
      expect(results.length).toBeGreaterThan(0)
    })

    it('should not rebuild index if it already exists', async () => {
      // Should still be able to search
      const results = await searcher.search({ query: 'console' })
      expect(results.length).toBeGreaterThan(0)
    })
  })
}) 
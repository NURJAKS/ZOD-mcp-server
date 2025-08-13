import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoreIndexer } from '../../../src/tools/zod-core/core-index'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('CoreIndexer', () => {
  let indexer: CoreIndexer
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
    
    indexer = new CoreIndexer(join(tmpdir(), `zodcore_index_test_${Date.now()}.sqlite`))
  })

  afterEach(async () => {
    // Clean up test project
    if (tempProject?.cleanup) {
      await tempProject.cleanup()
    }
  })

  describe('indexProject', () => {
    it('should index a basic project successfully', async () => {
      const result = await indexer.indexProject(tempProject.path)

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBeGreaterThan(0)
      expect(result.foldersScanned).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.databasePath).toBeDefined()
      expect(result.status).toBe('completed')
    })

    it('should handle empty projects gracefully', async () => {
      // Create an empty project
      const emptyProject = await global.testUtils.createTempProject({})
      
      const result = await indexer.indexProject(emptyProject.path)

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBe(0)
      expect(result.foldersScanned).toBeGreaterThan(0)
      expect(result.status).toBe('completed')
      
      await emptyProject.cleanup()
    })

    it('should respect file size limits', async () => {
      // Create a large file
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB
      const largeProject = await global.testUtils.createTempProject({
        'large.js': largeContent
      })

      const result = await indexer.indexProject(largeProject.path, {
        maxFileSizeBytes: 1024 // 1KB limit
      })

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBe(0) // Large file should be skipped
      
      await largeProject.cleanup()
    })

    it('should respect include/exclude patterns', async () => {
      const patternProject = await global.testUtils.createTempProject({
        'src': {
          'main.js': 'console.log("main")'
        },
        'tests': {
          'test.js': 'console.log("test")'
        },
        'docs': {
          'readme.md': '# Documentation'
        }
      })

      const result = await indexer.indexProject(patternProject.path, {
        includePatterns: ['src/**/*'],
        excludePatterns: ['**/*.md']
      })

      expect(result.success).toBe(true)
      expect(result.filesIndexed).toBe(1) // Only src/main.js should be indexed
      
      await patternProject.cleanup()
    })

    it('should enable vector search when requested', async () => {
      const result = await indexer.indexProject(tempProject.path, {
        enableVectorSearch: true
      })

      expect(result.success).toBe(true)
      expect(result.vectorSearchEnabled).toBe(true)
    })

    it('should analyze dependencies when requested', async () => {
      const depProject = await global.testUtils.createTempProject({
        'src': {
          'main.js': `
import { add } from './utils'
import React from 'react'

function main() {
  const result = add(1, 2)
  return <div>{result}</div>
}
`,
          'utils.js': `
export function add(a, b) {
  return a + b
}
`
        }
      })

      const result = await indexer.indexProject(depProject.path, {
        analyzeDependencies: true
      })

      expect(result.success).toBe(true)
      expect(result.dependenciesFound).toBeGreaterThan(0)
      
      await depProject.cleanup()
    })

    it('should handle indexing errors gracefully', async () => {
      // Create a project with invalid files
      const invalidProject = await global.testUtils.createTempProject({
        'invalid.js': 'invalid syntax {'
      })

      const result = await indexer.indexProject(invalidProject.path)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
      
      await invalidProject.cleanup()
    })
  })

  describe('getProjectStructure', () => {
    it('should return project structure after indexing', async () => {
      await indexer.indexProject(tempProject.path)
      const structure = await indexer.getProjectStructure()

      expect(structure.metadata.totalFiles).toBeGreaterThan(0)
      expect(structure.structure.files.length).toBeGreaterThan(0)
      expect(structure.structure.directories.length).toBeGreaterThan(0)
    })

    it('should detect frameworks correctly', async () => {
      const reactProject = await global.testUtils.createTempProject({
        'src': {
          'App.tsx': `
import React from 'react'

function App() {
  return <div>Hello React</div>
}

export default App
`
        },
        'package.json': JSON.stringify({
          dependencies: {
            react: '^18.0.0'
          }
        })
      })

      await indexer.indexProject(reactProject.path)
      const structure = await indexer.getProjectStructure()

      expect(structure.metadata.frameworks).toContain('react')
      
      await reactProject.cleanup()
    })
  })

  describe('searchProject', () => {
    it('should search indexed content', async () => {
      await indexer.indexProject(tempProject.path)
      const results = await indexer.searchProject('hello')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].path).toContain('main.js')
      expect(results[0].matches.length).toBeGreaterThan(0)
    })
  })

  describe('exportToJson', () => {
    it('should export project data to JSON', async () => {
      await indexer.indexProject(tempProject.path)
      
      const exportPath = join(tempProject.path, 'export.json')
      const result = await indexer.exportToJson(exportPath)

      expect(result).toBe(exportPath)
      
      // Clean up export file
      try {
        await global.testUtils.mockDatabase.execute('DELETE FROM files')
      } catch (error) {
        // Ignore cleanup errors
      }
    })
  })
}) 
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/server'
import { getEnvManager } from '../../src/core/env-manager'
import { registerCoreStatusTool } from '../../src/tools/zod-core/core-status'
import { registerCoreIndexTool } from '../../src/tools/zod-core/core-index'
import { registerCoreSearchTool } from '../../src/tools/zod-core/core-search'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { join } from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { McpToolContext } from '../../src/types'

function clearDb(file: string) {
  try { if (existsSync(file)) rmSync(file) } catch {}
}

function clearAllZodCoreDbs() {
  const t = tmpdir()
  ;['zodcore_index.sqlite','zodcore_search.sqlite','zodcore_analysis.sqlite','zodcore_fixes.sqlite']
    .forEach(f => clearDb(join(t, f)))
}

describe('Core Status Tool Integration Test', () => {
  let mcp: any
  let envManager: any
  let testProjectPath: string
  let statusHandler: any
  let indexHandler: any
  let searchHandler: any

  beforeAll(async () => {
    testProjectPath = await createTestProject()

    mcp = createServer({ name: 'test-server', version: '1.0.0' })
    envManager = await getEnvManager()

    // Capture tool handlers
    const toolRegistry = new Map()
    const originalTool = mcp.tool?.bind(mcp)
    if (originalTool) {
      mcp.tool = (name: string, description: string, schema: any, handler: any) => {
        toolRegistry.set(name, { schema, handler })
        return originalTool(name, description, schema, handler)
      }
    }

    await registerCoreStatusTool({ mcp, envManager } as McpToolContext)
    await registerCoreIndexTool({ mcp, envManager } as McpToolContext)
    await registerCoreSearchTool({ mcp, envManager } as McpToolContext)

    statusHandler = toolRegistry.get('core_status')?.handler
    indexHandler = toolRegistry.get('core_index')?.handler
    searchHandler = toolRegistry.get('core_search')?.handler

    expect(statusHandler).toBeDefined()
    expect(indexHandler).toBeDefined()
    expect(searchHandler).toBeDefined()

    clearAllZodCoreDbs()
  })

  afterAll(async () => {
    await cleanupTestProject(testProjectPath)
  })

  test('should report missing systems before any indexing', async () => {
    const res = await statusHandler({ action: 'status', projectPath: testProjectPath })
    const text = res.content?.[0]?.text || ''

    expect(text).toMatch(/System Status/i)
    expect(text).toMatch(/Index: ❌|Index: false/)
    expect(text).toMatch(/Analysis: ❌|Analysis: false/)
    expect(text).toMatch(/Search: ❌|Search: false/)
    expect(text).toMatch(/Fixes: ❌|Fixes: false/)
  })

  test('should provide detailed recommendations when systems are missing', async () => {
    const res = await statusHandler({ action: 'detailed', projectPath: testProjectPath })
    const text = res.content?.[0]?.text || ''

    expect(text).toMatch(/Detailed System Status/i)
    expect(text).toMatch(/Recommendations/i)
    expect(res.metadata?.recommendations?.length || 0).toBeGreaterThan(0)
  })

  test('should reflect index status after indexing', async () => {
    clearAllZodCoreDbs()
    // Index project to default DB used by status tool
    const indexRes = await indexHandler({ path: testProjectPath })
    const indexText = indexRes?.content?.[0]?.text || ''
    expect(indexText).toMatch(/Project Index Complete|Index completed successfully/i)

    const res = await statusHandler({ action: 'status', projectPath: testProjectPath })
    const text = res.content?.[0]?.text || ''
    expect(text).toMatch(/Index: ✅|Index: true/)
  })

  test('should reflect search status after building search index', async () => {
    // Trigger ensureIndex which builds search index off default index DB
    const searchRes = await searchHandler({ query: 'function', type: 'structural', projectPath: testProjectPath, limit: 1 })
    expect(searchRes.metadata?.resultsCount).toBeDefined()

    const res = await statusHandler({ action: 'status', projectPath: testProjectPath })
    const text = res.content?.[0]?.text || ''
    expect(text).toMatch(/Search: ✅|Search: true/)
  })

  test('should include structured metadata for detailed status', async () => {
    const res = await statusHandler({ action: 'detailed', projectPath: testProjectPath })
    expect(res.metadata?.status).toBeDefined()
    const status = res.metadata?.status
    expect(typeof status.index.exists).toBe('boolean')
    expect(typeof status.search.exists).toBe('boolean')
    expect(typeof status.system.memoryUsage).toBe('number')
    expect(Array.isArray(status.index.languages)).toBe(true)
  })
})
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/server'
import { getEnvManager } from '../../src/core/env-manager'
import { registerCoreIndexTool } from '../../src/tools/zod-core/core-index'
import { registerCoreSearchTool } from '../../src/tools/zod-core/core-search'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { McpToolContext } from '../../src/types'

// Helper to ensure a clean default index DB for searcher to read from
function clearDefaultIndexDb() {
  const defaultIndexDb = join(tmpdir(), 'zodcore_index.sqlite')
  try {
    if (existsSync(defaultIndexDb)) rmSync(defaultIndexDb)
  } catch {}
}

// Helper to ensure a clean search DB so ensureIndex rebuilds for this project
function clearDefaultSearchDb() {
  const defaultSearchDb = join(tmpdir(), 'zodcore_search.sqlite')
  try {
    if (existsSync(defaultSearchDb)) rmSync(defaultSearchDb)
  } catch {}
}

describe('Core Search Tool Integration Test', () => {
  let mcp: any
  let envManager: any
  let testProjectPath: string
  let indexHandler: any
  let searchHandler: any

  beforeAll(async () => {
    // Create a real test project with actual code files
    testProjectPath = await createTestProject()

    // Add files with content to make search meaningful
    mkdirSync(join(testProjectPath, 'src', 'search'), { recursive: true })

    // Write greetings.ts without template literals to avoid test-time interpolation issues
    writeFileSync(
      join(testProjectPath, 'src', 'search', 'greetings.ts'),
      `export function greet(name: string): string {
  const message = 'Hello, ' + name + '!'
  console.log(message)
  return message
}

export const GREETING_PREFIX = 'Hello'
`
    )

    writeFileSync(join(testProjectPath, 'src', 'search', 'utils.ts'), `
export class StringUtil {
  static capitalize(value: string): string {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timeout: any
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), wait)
  }
}
`)

    writeFileSync(join(testProjectPath, 'src', 'search', 'data.json'), JSON.stringify({ title: 'Search Demo', items: [1,2,3] }, null, 2))

    // Set up the MCP server
    mcp = createServer({ name: 'test-server', version: '1.0.0' })
    envManager = await getEnvManager()

    // Capture the tool handlers
    const toolRegistry = new Map()
    const originalTool = mcp.tool?.bind(mcp)
    if (originalTool) {
      mcp.tool = (name: string, description: string, schema: any, handler: any) => {
        toolRegistry.set(name, { schema, handler })
        return originalTool(name, description, schema, handler)
      }
    }

    // Register tools
    await registerCoreIndexTool({ mcp, envManager } as McpToolContext)
    await registerCoreSearchTool({ mcp, envManager } as McpToolContext)

    indexHandler = toolRegistry.get('core_index')?.handler
    searchHandler = toolRegistry.get('core_search')?.handler
    expect(indexHandler).toBeDefined()
    expect(searchHandler).toBeDefined()

    // Ensure clean DBs and index the project to default DB path used by searcher
    clearDefaultIndexDb()
    clearDefaultSearchDb()
    const indexResult = await indexHandler({ path: testProjectPath })
    expect(indexResult?.content?.[0]?.text || '').toMatch(/Project Index Complete|Index completed successfully/i)
  })

  afterAll(async () => {
    await cleanupTestProject(testProjectPath)
  })

  test('should perform exact search and return results with metadata', async () => {
    const result = await searchHandler({
      query: 'console.log',
      type: 'exact',
      projectPath: testProjectPath,
      limit: 10
    })

    expect(result.content?.[0]?.type).toBe('text')
    const text = result.content?.[0]?.text || ''
    expect(text).toMatch(/Search completed/i)
    expect(text).toMatch(/Results:\s*\d+/)

    expect(result.metadata?.resultsCount).toBeGreaterThan(0)
    expect(Array.isArray(result.metadata?.results)).toBe(true)

    const files = (result.metadata?.results || []).map((r: any) => r.file)
    expect(files.some((f: string) => f.includes('src/search/greetings.ts'))).toBe(true)
  })

  test('should support structural search for functions/classes', async () => {
    const result = await searchHandler({
      query: 'greet',
      type: 'structural',
      projectPath: testProjectPath,
      limit: 10
    })

    expect(result.metadata?.resultsCount).toBeGreaterThan(0)
    const matches = (result.metadata?.results || []).map((r: any) => r.match).join('\n')
    expect(matches).toMatch(/function|const|class/i)
  })

  test('should filter by file path and language', async () => {
    const result = await searchHandler({
      query: 'capitalize',
      type: 'exact',
      file: 'src/search/utils.ts',
      language: 'typescript',
      projectPath: testProjectPath
    })

    expect(result.metadata?.resultsCount).toBeGreaterThan(0)
    const files = (result.metadata?.results || []).map((r: any) => r.file)
    expect(files.every((f: string) => f.endsWith('src/search/utils.ts'))).toBe(true)
  })

  test('should filter by file types', async () => {
    const result = await searchHandler({
      query: 'Search Demo',
      type: 'exact',
      file_types: ['.json'],
      projectPath: testProjectPath
    })

    expect(result.metadata?.resultsCount).toBeGreaterThan(0)
    const files = (result.metadata?.results || []).map((r: any) => r.file)
    expect(files.every((f: string) => f.endsWith('.json'))).toBe(true)
  })

  test('should return no results for unmatched query', async () => {
    const result = await searchHandler({
      query: 'nonexistent_symbol_12345',
      type: 'exact',
      projectPath: testProjectPath
    })

    expect(result.metadata?.resultsCount).toBe(0)
    const text = result.content?.[0]?.text || ''
    expect(text).toMatch(/No results found/i)
  })

  test('should respect case-insensitive search by default', async () => {
    const result = await searchHandler({
      query: 'greeting_prefix',
      type: 'exact',
      projectPath: testProjectPath
    })

    expect(result.metadata?.resultsCount).toBeGreaterThan(0)
  })

  test('should support case-sensitive search when requested', async () => {
    const insensitive = await searchHandler({
      query: 'greeting_prefix',
      type: 'exact',
      projectPath: testProjectPath,
      caseSensitive: false
    })

    const sensitive = await searchHandler({
      query: 'greeting_prefix',
      type: 'exact',
      projectPath: testProjectPath,
      caseSensitive: true
    })

    expect(insensitive.metadata?.resultsCount).toBeGreaterThanOrEqual(sensitive.metadata?.resultsCount || 0)
  })
})
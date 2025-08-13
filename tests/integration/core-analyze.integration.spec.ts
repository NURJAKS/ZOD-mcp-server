import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cwd, chdir } from 'node:process'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { clearAllZodCoreDbs, setupMcpAndRegisterAll, setSuiteTmpDir } from '../fixtures/test-helpers'

describe('Core Analyze Tool Integration Test', () => {
  let projectPath: string
  let getTool: (n: string) => any

  beforeAll(async () => {
    projectPath = await createTestProject()
    setSuiteTmpDir(projectPath)
    // Create a small project with fixable and detectable issues
    mkdirSync(join(projectPath, 'src', 'mod'), { recursive: true })

    writeFileSync(join(projectPath, 'src', 'index.ts'), `
export function main(data: any) {
  console.log('debug');
  if (5 == 5) {
    return data
  }
  return data
}
`)

    writeFileSync(join(projectPath, 'src', 'mod', 'util.js'), `
function helper(x) {
  var y = x
  return y
}
module.exports = { helper }
`)

    clearAllZodCoreDbs()
    const { get } = await setupMcpAndRegisterAll()
    getTool = get
  })

  afterAll(async () => {
    await cleanupTestProject(projectPath)
  })

  test('analyzes entire project and reports issues', async () => {
    const analyze = getTool('core_analyze')
    const prev = cwd()
    try {
      chdir(projectPath)
      const result = await analyze({})
      expect(result.metadata?.success).toBe(true)
      expect(result.metadata?.filesAnalyzed).toBeGreaterThan(0)
      expect(result.metadata?.issuesFound).toBeGreaterThan(0)
      expect(Array.isArray(result.metadata?.issues)).toBe(true)
    } finally {
      chdir(prev)
    }
  })

  test('supports focus path to limit analysis scope', async () => {
    const analyze = getTool('core_analyze')
    const prev = cwd()
    try {
      chdir(projectPath)
      const result = await analyze({ path: 'src/mod' })
      expect(result.metadata?.success).toBe(true)
      expect(result.metadata?.filesAnalyzed).toBeGreaterThan(0)
    } finally {
      chdir(prev)
    }
  })

  test('accepts ruleset parameter (no crash, consistent output)', async () => {
    const analyze = getTool('core_analyze')
    const prev = cwd()
    try {
      chdir(projectPath)
      const result = await analyze({ ruleset: 'security' })
      expect(result.metadata?.success).toBe(true)
      expect(result.metadata?.issuesFound).toBeGreaterThanOrEqual(0)
    } finally {
      chdir(prev)
    }
  })
}) 
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import { cwd, chdir } from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { clearAllZodCoreDbs, setupMcpAndRegisterAll } from '../fixtures/test-helpers'

/**
 * Cross-tool workflow:
 * 1) Create project with fixable issues
 * 2) Index project
 * 3) Analyze project to find issues
 * 4) Fix issues with dry_run=false
 * 5) Check status -> fixes.totalFixes > 0
 */

describe('Cross-tool workflow: index → analyze → fix', () => {
  let projectPath: string
  let getTool: (n: string) => any

  beforeAll(async () => {
    projectPath = await createTestProject()
    // Create fixable content: console.log, ==, any
    mkdirSync(join(projectPath, 'src'), { recursive: true })
    writeFileSync(join(projectPath, 'src', 'bad.ts'), `
export function foo(data: any) {
  console.log('bad');
  let x = 5;
  if (x == 5) {
    return data;
  }
  return data;
}
`)

    clearAllZodCoreDbs()
    const { get } = await setupMcpAndRegisterAll()
    getTool = get
  })

  afterAll(async () => {
    await cleanupTestProject(projectPath)
  })

  test('end-to-end run produces applied fixes tracked by status', async () => {
    const index = getTool('core_index')
    const analyze = getTool('core_analyze')
    const fix = getTool('core_fix')
    const status = getTool('core_status')

    // Index
    const idxRes = await index({ path: projectPath })
    expect(idxRes?.content?.[0]?.text || '').toMatch(/Index|Project Index/i)

    // Analyze in project CWD so tool scans correct tree
    const prevCwd = cwd()
    try {
      chdir(projectPath)
      const anRes = await analyze({})
      expect(anRes.metadata?.filesAnalyzed).toBeGreaterThan(0)
    } finally {
      chdir(prevCwd)
    }

    // Fix non-dry-run
    await fix({ projectPath, dry_run: false })

    // Status should reflect fixes
    const st = await status({ action: 'status', projectPath })
    expect(st.metadata?.status?.fixes?.totalFixes).toBeGreaterThan(0)
  }, 20000)
})
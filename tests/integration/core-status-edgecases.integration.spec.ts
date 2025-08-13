import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync, rmSync } from 'node:fs'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { clearAllZodCoreDbs, setupMcpAndRegisterAll } from '../fixtures/test-helpers'

describe('Core Status Edge Cases', () => {
  let projectPath: string
  let getTool: (n: string) => any

  beforeAll(async () => {
    projectPath = await createTestProject()
    clearAllZodCoreDbs()
    const { get } = await setupMcpAndRegisterAll()
    getTool = get
  })

  afterAll(async () => {
    await cleanupTestProject(projectPath)
  })

  test('handles missing/partial databases gracefully', async () => {
    const status = getTool('core_status')
    const res = await status({ action: 'status', projectPath })
    const text = res.content?.[0]?.text || ''
    expect(text).toMatch(/System Status/i)
    // All false/zero when DBs missing
    expect(text).toMatch(/Index: ❌|Index: false/)
  })

  test('handles corrupted index database file gracefully', async () => {
    const status = getTool('core_status')
    // Write invalid sqlite file at expected path
    const corrupt = join(tmpdir(), 'zodcore_index.sqlite')
    try { if (existsSync(corrupt)) rmSync(corrupt) } catch {}
    writeFileSync(corrupt, 'not-a-sqlite-db')

    const res = await status({ action: 'status', projectPath })
    // Should not throw; should report index as not existing
    expect(res.metadata?.status?.index?.exists).toBe(false)
  })
})
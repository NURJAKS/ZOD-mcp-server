import { describe, it, expect } from 'vitest'
import { handle } from '../src/tools/zod-core/core'

describe('ZOD Core structured response', () => {
  it('returns structured fields (text, memoryHits, usedTools, trace)', async () => {
    const res = await handle(
      { query: 'Explain purpose of project', intent: 'explain' },
      { sessionId: 'test-structured', projectPath: process.cwd() },
    )
    expect(typeof res.text).toBe('string')
    // memoryHits may be empty depending on embedding availability
    expect(Array.isArray(res.memoryHits || [])).toBe(true)
    expect(Array.isArray(res.usedTools || [])).toBe(true)
    expect(typeof (res as any).trace === 'string' || typeof (res as any).trace === 'undefined').toBe(true)
  })

  it('handles planning intent correctly', async () => {
    const res = await handle(
      { query: 'Plan refactoring of authentication system', intent: 'plan' },
      { sessionId: 'test-planning', projectPath: process.cwd() },
    )
    expect(typeof res.text).toBe('string')
    expect(res.kind === 'strategy' || res.kind === 'response').toBe(true)
  })

  it('handles error gracefully when embeddings unavailable', async () => {
    // This test should pass even without OPENROUTER_API_KEY
    const res = await handle(
      { query: 'Analyze code quality', intent: 'analyze' },
      { sessionId: 'test-error', projectPath: process.cwd() },
    )
    expect(typeof res.text).toBe('string')
    // Should either work or give a clear error message
    expect(res.text.length > 0).toBe(true)
  })
})


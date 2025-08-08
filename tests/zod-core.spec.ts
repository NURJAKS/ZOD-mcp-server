import { describe, it, expect } from 'vitest'
import { handle } from '../src/tools/zod-core/core'

describe('ZOD Core Orchestrator', () => {
  it('handles explain intent without MCP server', async () => {
    const res = await handle({ query: 'Explain purpose of project', intent: 'explain' }, { sessionId: 'test', projectPath: process.cwd() })
    expect(res.text.length).toBeGreaterThan(0)
  })
})


import { describe, it, expect, vi } from 'vitest'
import { ZodCoreOrchestrator } from '../src/tools/zod-core/core'

describe('Tool routing decisions', () => {
  it('does not throw when routing planned actions (no MCP tools bound)', async () => {
    const orch = new ZodCoreOrchestrator()
    ;(orch as any).mcp = { getTool() { return null }, __toolHandlers: new Map() }
    const res = await orch.handle(
      { query: 'Visualize architecture', intent: 'reflect' },
      { sessionId: 'test-route', projectPath: process.cwd(), toolPreferences: { allowVisualizer: true } },
    )
    expect(['response','insight','strategy']).toContain(res.kind)
  })
})


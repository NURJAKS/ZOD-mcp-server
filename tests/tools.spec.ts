import { describe, it, expect } from 'vitest'
import { createServer } from '../src/server'
import { registerRepositoryTools } from '../src/tools/repository'
import { registerDocumentationTools } from '../src/tools/documentation'
import { registerUnifiedSearchTools } from '../src/tools/unified-search'
import { registerProjectInitTools } from '../src/tools/project-init'

describe('MCP tools registration', () => {
  it('registers unified tools with actions without error', async () => {
    const mcp = createServer({ name: 'test', version: '0.0.0' }) as any
    // intercept registration
    const registry = new Map<string, any>()
    const original = mcp.tool.bind(mcp)
    mcp.tool = (name: string, desc: string, schema: any, handler: any) => {
      registry.set(name, { schema, handler })
      return original(name, desc, schema, handler)
    }

    registerRepositoryTools({ mcp })
    registerDocumentationTools({ mcp })
    registerUnifiedSearchTools({ mcp })
    registerProjectInitTools({ mcp })

    // unified tool ids only
    for (const key of [
      'repository_tools','documentation_tools','webdeep_research','initialize_project',
    ]) {
      expect(registry.has(key)).toBe(true)
    }
  })
})


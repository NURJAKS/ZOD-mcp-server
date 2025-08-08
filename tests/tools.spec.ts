import { describe, it, expect } from 'vitest'
import { createServer } from '../src/server'
import { registerRepositoryTools } from '../src/tools/repository'
import { registerDocumentationTools } from '../src/tools/documentation'
import { registerUnifiedSearchTools } from '../src/tools/unified-search'
import { registerProjectInitTools } from '../src/tools/project-init'

describe('MCP tools registration', () => {
  it('registers tools and aliases without error', async () => {
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

    // spot-check presence of aliases
    for (const key of [
      'index_repository','list_repositories','check_repository_status','delete_repository','rename_repository','search_codebase',
      'index_documentation','list_documentation','check_documentation_status','delete_documentation','rename_documentation','search_documentation',
      'nia_web_search','nia_deep_research_agent',
    ]) {
      expect(registry.has(key)).toBe(true)
    }
  })
})


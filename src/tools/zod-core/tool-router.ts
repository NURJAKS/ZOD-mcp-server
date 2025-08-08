import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadZodCoreConfig } from './config'

export interface RoutedCall {
  tool:
  | 'repository_tools'
  | 'documentation_tools'
  | 'web&deep_research'
  | 'initialize_project'
  | 'multi_agent_tools'
  | 'visualizer'
  | 'zod_core'
  // explicit aliases
  | 'index_repository' | 'list_repositories' | 'check_repository_status' | 'delete_repository' | 'rename_repository' | 'search_codebase'
  | 'index_documentation' | 'list_documentation' | 'check_documentation_status' | 'delete_documentation' | 'rename_documentation' | 'search_documentation'
  | 'nia_web_search' | 'nia_deep_research_agent'
  params: any
}

export class ToolRouter {
  constructor(private mcp: McpServer) {}

  async route(calls: RoutedCall[]): Promise<Array<{ name: string; result: any }>> {
    const cfg = loadZodCoreConfig()
    const out: Array<{ name: string; result: any }> = []
    for (const call of calls) {
      if (!this.allowed(call.tool, cfg)) continue
      const registry: Map<string, any> | undefined = (this.mcp as any).__toolHandlers
      const entry = registry?.get(call.tool)
      if (!entry) continue
      // Validate if schema present
      const schema: z.ZodSchema | undefined = entry.schema
      const params = schema ? schema.parse(call.params) : call.params
      const result = await entry.handler(params)
      out.push({ name: call.tool, result })
    }
    return out
  }

  private allowed(name: string, cfg: ReturnType<typeof loadZodCoreConfig>): boolean {
    if (name.includes('visualizer')) return cfg.tools.visualizer
    if (name.includes('repository')) return cfg.tools.repository
    if (name.includes('documentation')) return cfg.tools.documentation
    if (name.includes('web') || name.includes('research')) return cfg.tools.webDeepResearch
    if (name.includes('initialize') || name.includes('project')) return cfg.tools.projectInit
    if (name.includes('agent')) return cfg.tools.multiAgent
    return true
  }
}


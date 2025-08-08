import { z } from 'zod'
import type { McpToolContext } from '../../types'
import { SemanticMemory } from './semantic-memory'
import { createWorkingMemory } from './working-memory'
import { ReflectiveLayer } from './reflective-layer'
import { ToolRouter } from './tool-router'
import { loadZodCoreConfig } from './config'
import type { ZodQuery, ZodContext, OrchestratorResponse, ZodResult } from './types'
import { safeLog } from '../../utils'

const ZodQuerySchema = z.object({
  intent: z.enum(['analyze','explain','suggest','plan','reflect']).optional(),
  query: z.string(),
  area: z.string().optional(),
  targetPath: z.string().optional(),
  maxDepth: z.number().optional(),
})

// More flexible schema for tool input
const ToolInputSchema = z.object({
  action: z.enum(['handle','cli']).optional().default('handle'),
  sessionId: z.string().default(() => Math.random().toString(36).slice(2)),
  query: z.string().describe('Natural language query or instruction'),
  intent: z.enum(['analyze','explain','suggest','plan','reflect']).optional(),
  projectPath: z.string().optional(),
  area: z.string().optional(),
  targetPath: z.string().optional(),
  maxDepth: z.number().optional(),
  preferInternalAnalysis: z.boolean().optional(),
  allowVisualizer: z.boolean().optional(),
  allowExternalSearch: z.boolean().optional(),
  allowInit: z.boolean().optional(),
})

const ZodContextSchema = z.object({
  projectPath: z.string().optional(),
  sessionId: z.string(),
  toolPreferences: z.object({
    allowExternalSearch: z.boolean().optional(),
    allowVisualizer: z.boolean().optional(),
    allowInit: z.boolean().optional(),
    preferInternalAnalysis: z.boolean().optional(),
  }).optional(),
  environment: z.record(z.string()).optional(),
})

export class ZodCoreOrchestrator {
  private memory = new SemanticMemory()
  private working = createWorkingMemory()
  private reflective = new ReflectiveLayer()
  private mcp!: McpToolContext['mcp']

  bind(mcp: McpToolContext['mcp']) { this.mcp = mcp }

  async handle(query: ZodQuery, context: ZodContext): Promise<OrchestratorResponse> {
    const cfg = loadZodCoreConfig(context.projectPath)
    if (!this.mcp) throw new Error('ZodCoreOrchestrator not bound to MCP')

    // Update working memory with latest intent and query
    await this.working.patch(context.sessionId, {
      lastQuery: query.query,
      lastIntent: query.intent || 'explain',
      area: query.area,
      targetPath: query.targetPath,
    })

    // 1) Gather semantic context (conditionally)
    let memoryHitsText = ''
    const memoryHits: OrchestratorResponse['memoryHits'] = []
    try {
      if (context.projectPath && (query.intent !== 'reflect' || !(context.toolPreferences?.preferInternalAnalysis === false))) {
        await this.memory.ensureIndexedProject(context.projectPath, 'local')
        const hits = await this.memory.searchProject(query.query, { limit: cfg.memory.maxResults, scoreThreshold: cfg.memory.scoreThreshold })
        memoryHitsText = hits.map(h => `- [${(h.payload as any).path || (h.payload as any).title}] score=${h.score.toFixed(2)}\n${(h.payload as any).content}`).join('\n')
        for (const h of hits) {
          const p: any = h.payload
          memoryHits.push({
            source: p.type === 'page' ? 'doc' : 'file',
            pathOrUrl: p.path || p.url || '',
            title: p.title,
            language: p.language,
            score: h.score,
            snippet: p.content,
          })
        }
      }
    } catch (e) {
      safeLog(`ZOD Core semantic memory warning: ${e}`, 'warn')
    }

    // 2) Working memory state
    const wm = await this.working.get(context.sessionId)

    // 3) Reflective reasoning
    const reasoning = await this.reflective.reason({
      intent: query.intent || 'explain',
      query: query.query,
      memoryContext: memoryHitsText,
      workingState: wm?.state,
      preferences: context.toolPreferences,
    })

    // 4) Decide whether to call tools
    const router = new ToolRouter(this.mcp)
    const proposed = reasoning.actions || []
    const conditionalCalls = [] as { tool: any; params: any }[]
    if (query.intent === 'plan' || query.intent === 'reflect' || query.intent === 'analyze') {
      for (const a of proposed) {
        const name = a.tool || ''
        const prefs = context.toolPreferences || {}
        if (name.includes('visualizer') && prefs.allowVisualizer === false) continue
        if ((name.includes('web') || name.includes('research')) && prefs.allowExternalSearch === false) continue
        if ((name.includes('initialize') || name.includes('project')) && prefs.allowInit === false) continue
        conditionalCalls.push({ tool: a.tool, params: a.params })
      }
    }

    const usedTools: string[] = []
    let routedResults: Array<{ name: string; result: any }> = []
    if (conditionalCalls.length > 0) {
      try {
        routedResults = await router.route(conditionalCalls as any)
        usedTools.push(...routedResults.map(r => r.name))
      } catch (e) {
        safeLog(`ZOD Core routing warning: ${e}`, 'warn')
      }
    }

    // 5) Compose final response
    const result: OrchestratorResponse = {
      kind: query.intent === 'plan' ? 'strategy' : query.intent === 'reflect' ? 'insight' : 'response',
      title: query.intent?.toUpperCase(),
      text: reasoning.answer,
      data: routedResults,
      memoryHits,
      usedTools,
      sessionId: context.sessionId,
      workingState: wm?.state,
      trace: reasoning.reasoning,
    }

    // 6) Persist outcome in working memory
    await this.working.patch(context.sessionId, {
      lastOutcome: { kind: result.kind, usedTools, at: Date.now() },
    })

    return result
  }
}

export function registerZodCoreTool({ mcp }: McpToolContext) {
  const orchestrator = new ZodCoreOrchestrator()
  orchestrator.bind(mcp)

  mcp.tool(
    'zod_core',
    'ZOD Core — Context-Aware Cognitive Kernel. Analyze/explain/plan/reflect with selective tool delegation.',
    {
      action: z.enum(['handle','cli']).optional().default('handle'),
      sessionId: z.string().default(() => Math.random().toString(36).slice(2)),
      query: z.string().describe('Natural language query or instruction'),
      intent: z.enum(['analyze','explain','suggest','plan','reflect']).optional(),
      projectPath: z.string().optional(),
      area: z.string().optional(),
      targetPath: z.string().optional(),
      maxDepth: z.number().optional(),
      preferInternalAnalysis: z.boolean().optional(),
      allowVisualizer: z.boolean().optional(),
      allowExternalSearch: z.boolean().optional(),
      allowInit: z.boolean().optional(),
    },
    async (input) => {
      try {
        // Handle legacy calls where intent might be passed as action
        let actualIntent = input.intent
        if (input.action && ['analyze','explain','suggest','plan','reflect'].includes(input.action as any)) {
          actualIntent = input.action as any
        }
        
        const zq: ZodQuery = ZodQuerySchema.parse({
          query: input.query,
          intent: actualIntent,
          area: input.area,
          targetPath: input.targetPath,
          maxDepth: input.maxDepth,
        })
        const zc: ZodContext = ZodContextSchema.parse({
          sessionId: input.sessionId,
          projectPath: input.projectPath,
          toolPreferences: {
            allowExternalSearch: input.allowExternalSearch,
            allowVisualizer: input.allowVisualizer,
            allowInit: input.allowInit,
            preferInternalAnalysis: input.preferInternalAnalysis,
          },
          environment: process.env,
        })

        const result = await orchestrator.handle(zq, zc)
        return {
          content: [{ type: 'text' as const, text: result.text }],
          metadata: {
            sessionId: result.sessionId,
            intent: zq.intent || 'explain',
            usedTools: result.usedTools,
            memoryHits: result.memoryHits,
            trace: (result as any).trace,
          }
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text' as const, 
            text: `ZOD Core error: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure you have OPENROUTER_API_KEY set for embeddings.` 
          }],
          metadata: {
            sessionId: input.sessionId,
            intent: input.intent || 'explain',
            error: true,
          }
        }
      }
    }
  )

  return { orchestrator }
}

// CLI-compat entry — programmatic API
export async function handle(query: ZodQuery, context: ZodContext): Promise<ZodResult> {
  const orch = new ZodCoreOrchestrator()
  // Standalone usage does not have MCP server; only internal logic used
  ;(orch as any).mcp = {
    getTool() { return null },
  } as any
  return await orch.handle(query, context)
}


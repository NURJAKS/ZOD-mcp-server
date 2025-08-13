import { z } from 'zod'
import type { McpToolContext } from '../../types'
import { safeLog } from '../../utils'

// Simplified schema for explain-only functionality
const ExplainQuerySchema = z.object({
  query: z.string(),
  targetPath: z.string().optional(),
  maxDepth: z.number().optional(),
})

const ExplainContextSchema = z.object({
  projectPath: z.string().optional(),
  sessionId: z.string(),
})

// Simplified tool input schema
const ToolInputSchema = z.object({
  action: z.enum(['handle','cli']).optional().default('handle'),
  sessionId: z.string().default(() => Math.random().toString(36).slice(2)),
  query: z.string().describe('Natural language query or instruction'),
  projectPath: z.string().optional(),
  targetPath: z.string().optional(),
  maxDepth: z.number().optional(),
})

export interface ExplainResult {
  kind: 'response'
  title: string
  text: string
  sessionId: string
}

export class ZodCoreExplainer {
  async explain(query: string, context: { projectPath?: string; sessionId: string }): Promise<ExplainResult> {
    // Simple explanation logic without complex dependencies
    const explanation = await this.generateExplanation(query, context.projectPath)
    
    return {
      kind: 'response',
      title: 'EXPLAIN',
      text: explanation,
      sessionId: context.sessionId,
    }
  }

  private async generateExplanation(query: string, projectPath?: string): Promise<string> {
    // Basic explanation generation without external dependencies
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('what') || lowerQuery.includes('how') || lowerQuery.includes('why')) {
      return `I'll help you understand this. Based on your query "${query}", here's what I can explain:\n\n` +
             `• The project structure and organization\n` +
             `• Code patterns and architectural decisions\n` +
             `• Function and class purposes\n` +
             `• Data flow and dependencies\n\n` +
             `To get more specific information, try asking about particular files, functions, or concepts.`
    }
    
    if (lowerQuery.includes('function') || lowerQuery.includes('method')) {
      return `I can help you understand functions and methods in your codebase. ` +
             `Try asking about specific function names or file paths for detailed explanations.`
    }
    
    if (lowerQuery.includes('class') || lowerQuery.includes('component')) {
      return `I can explain classes, components, and their relationships. ` +
             `Ask about specific class names or component files for detailed analysis.`
    }
    
    return `I'm here to help you understand your codebase. Ask me about:\n\n` +
           `• Specific files or functions\n` +
           `• Code patterns and architecture\n` +
           `• How different parts work together\n` +
           `• Best practices and improvements\n\n` +
           `For example: "Explain the authentication flow" or "What does this function do?"`
  }
}

export type ZodCoreIntent = 'explain' | 'plan' | 'reflect' | 'analyze'

export interface ZodCoreHandleInput {
  query: string
  intent?: ZodCoreIntent
}

export interface ZodCoreHandleContext {
  sessionId: string
  projectPath?: string
  toolPreferences?: Record<string, unknown>
}

export type ZodCoreHandled = {
  kind: 'response' | 'strategy' | 'insight'
  text: string
  title?: string
  memoryHits?: any[]
  usedTools?: string[]
  trace?: string
}

export class ZodCoreOrchestrator {
  private explainer: ZodCoreExplainer

  constructor() {
    this.explainer = new ZodCoreExplainer()
  }

  async handle(input: ZodCoreHandleInput, context: ZodCoreHandleContext): Promise<ZodCoreHandled> {
    const intent: ZodCoreIntent = input.intent || 'explain'

    // Keep implementation simple and deterministic for tests
    if (intent === 'plan') {
      const planText = `High-level plan for: ${input.query}\n\n- Analyze current state\n- Identify gaps\n- Propose steps\n- Estimate effort`
      return {
        kind: 'strategy',
        text: planText,
        title: 'PLAN',
        memoryHits: [],
        usedTools: [],
      }
    }

    if (intent === 'reflect') {
      const insight = `Reflection on: ${input.query}\n\n• Architecture overview\n• Key trade-offs\n• Risks and mitigations`
      return {
        kind: 'insight',
        text: insight,
        title: 'REFLECT',
        memoryHits: [],
        usedTools: [],
      }
    }

    // Default to explain/analyze using the explainer
    const result = await this.explainer.explain(input.query, { projectPath: context.projectPath, sessionId: context.sessionId })
    return {
      kind: 'response',
      text: result.text,
      title: 'EXPLAIN',
      memoryHits: [],
      usedTools: [],
    }
  }
}

export function registerZodCoreTool({ mcp }: McpToolContext) {
  const explainer = new ZodCoreExplainer()

  mcp.tool(
    'core_explain',
    'Core Explain — Simplified Code Explanation Tool. Ask questions about your codebase.',
    {
      action: z.enum(['handle','cli']).optional().default('handle'),
      sessionId: z.string().default(() => Math.random().toString(36).slice(2)),
      query: z.string().describe('Natural language query or instruction'),
      projectPath: z.string().optional(),
      targetPath: z.string().optional(),
      maxDepth: z.number().optional(),
    },
    async (input) => {
      try {
        const eq: { query: string; targetPath?: string; maxDepth?: number } = ExplainQuerySchema.parse({
          query: input.query,
          targetPath: input.targetPath,
          maxDepth: input.maxDepth,
        })
        
        const ec: { projectPath?: string; sessionId: string } = ExplainContextSchema.parse({
          sessionId: input.sessionId,
          projectPath: input.projectPath,
        })

        const result = await explainer.explain(eq.query, ec)
        
        return {
          content: [{ type: 'text' as const, text: result.text }],
          metadata: {
            sessionId: result.sessionId,
            intent: 'explain',
          }
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text' as const, 
            text: `ZOD Core error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }],
          metadata: {
            sessionId: input.sessionId,
            intent: 'explain',
            error: true,
          }
        }
      }
    }
  )

  return { explainer }
}

// CLI-compat entry — programmatic API
export async function explain(query: string, context: { projectPath?: string; sessionId: string }): Promise<ExplainResult> {
  const explainer = new ZodCoreExplainer()
  return await explainer.explain(query, context)
}

// Simple programmatic handle API used by tests
export async function handle(input: ZodCoreHandleInput, context: ZodCoreHandleContext): Promise<ZodCoreHandled> {
  const orch = new ZodCoreOrchestrator()
  return orch.handle(input, context)
}


import { safeLog } from '../../utils'

// Lazy import to avoid mandatory dependency
let OpenRouter: any = null
try {
  OpenRouter = require('openrouter-client')
} catch {
  // optional
}

export interface ReasoningInput {
  intent: string
  query: string
  memoryContext: string
  workingState?: Record<string, any>
  preferences?: Record<string, any>
}

export interface ReasoningOutput {
  reasoning: string
  answer: string
  actions?: Array<{ tool: string; params: any; reason?: string }>
}

export class ReflectiveLayer {
  private client: any | null = null

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (apiKey && OpenRouter) {
      try {
        this.client = new OpenRouter({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
      } catch (e) {
        safeLog(`ReflectiveLayer: failed to init OpenRouter: ${e}`, 'warn')
        this.client = null
      }
    }
  }

  async reason(input: ReasoningInput): Promise<ReasoningOutput> {
    const sys = `You are ZOD Core, an engineering reasoning module. Be precise, concise, and actionable. Output structured, production-grade insights. Decide when tools are needed.`
    const prompt = [
      `Intent: ${input.intent}`,
      `Query: ${input.query}`,
      `Working State: ${JSON.stringify(input.workingState || {})}`,
      `Context:\n${input.memoryContext.substring(0, 6000)}`,
      `Preferences: ${JSON.stringify(input.preferences || {})}`,
      'Think step-by-step. If tools are necessary, propose them with minimal params.',
    ].join('\n\n')

    if (this.client) {
      try {
        const model = process.env.OPENROUTER_REASONING_MODEL || 'openrouter/deepseek/deepseek-coder'
        const resp = await this.client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        })
        const content = resp.choices?.[0]?.message?.content || ''
        const parsed = this.parse(content)
        return parsed
      } catch (e) {
        safeLog(`ReflectiveLayer: OpenRouter failover: ${e}`, 'warn')
      }
    }

    // Deterministic local fallback
    const fallback = this.localPlan(prompt)
    return fallback
  }

  private parse(raw: string): ReasoningOutput {
    // Simple heuristic parser: try to detect actions JSON fenced blocks; otherwise treat as text
    const actionMatch = raw.match(/```(json)?[\s\S]*?\{[\s\S]*?\}[\s\S]*?```/)
    let actions: ReasoningOutput['actions']
    if (actionMatch) {
      try {
        const jsonText = actionMatch[0].replace(/```(json)?/g, '').replace(/```/g, '').trim()
        const obj = JSON.parse(jsonText)
        if (Array.isArray(obj.actions)) actions = obj.actions
      } catch {
        // ignore parse error
      }
    }
    const answer = raw.replace(/```[\s\S]*?```/g, '').trim()
    return { reasoning: raw.slice(0, 2000), answer, actions }
  }

  private localPlan(prompt: string): ReasoningOutput {
    // Minimal deterministic plan choosing based on prompt semantics
    const lower = prompt.toLowerCase()
    const actions: ReasoningOutput['actions'] = []
    if (lower.includes('visualiz')) actions?.push({ tool: 'visualizer', params: {} , reason: 'User asked for architecture/visualization' })
    if (lower.includes('index') || lower.includes('analyz')) actions?.push({ tool: 'repository', params: { action: 'list' }, reason: 'May need repository context' })
    return {
      reasoning: 'Local rule-based reasoning used due to missing LLM credentials.',
      answer: 'Generated response using available semantic memory and heuristics.',
      actions,
    }
  }
}


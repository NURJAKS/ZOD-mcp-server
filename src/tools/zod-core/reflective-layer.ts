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
    const sys = `You are ZOD Core, an engineering reasoning module. Be precise, concise, and actionable. Output structured, production-grade insights. Decide when tools are needed. When proposing actions, return a JSON block in a fenced code block: \n\n\`\`\`json\n{ "answer": "...", "actions": [{ "tool": "repository_tools", "params": {"action": "list"}, "reason": "..." }]}\n\`\`\``
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
    // Expect JSON block like: ```json {"answer":"...","actions":[{...}]} ```
    const fenced = raw.match(/```json[\s\S]*?```/)
    if (fenced) {
      try {
        const json = fenced[0].replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(json)
        return {
          reasoning: raw.slice(0, 4000),
          answer: typeof parsed.answer === 'string' ? parsed.answer : raw.replace(/```[\s\S]*?```/g, '').trim(),
          actions: Array.isArray(parsed.actions) ? parsed.actions : undefined,
        }
      } catch { /* fallthrough */ }
    }
    return { reasoning: raw.slice(0, 4000), answer: raw.replace(/```[\s\S]*?```/g, '').trim() }
  }

  private localPlan(prompt: string): ReasoningOutput {
    const lower = prompt.toLowerCase()
    const actions: ReasoningOutput['actions'] = []
    if (lower.includes('visualiz')) actions?.push({ tool: 'visualizer', params: { action: 'visualize' }, reason: 'Architecture/visualization requested' })
    if (lower.includes('document') || lower.includes('docs')) actions?.push({ tool: 'documentation_tools', params: { action: 'search', query: 'project' }, reason: 'Documentation insight requested' })
    if (lower.includes('init') || lower.includes('setup')) actions?.push({ tool: 'initialize_project', params: { project_root: process.cwd() }, reason: 'Project initialization requested' })
    if (lower.includes('research') || lower.includes('web')) actions?.push({ tool: 'web&deep_research', params: { action: 'web_search', query: 'topic' }, reason: 'External research requested' })
    if (lower.includes('agent') || lower.includes('delegate')) actions?.push({ tool: 'multi_agent_tools', params: { action: 'launch_fleet' }, reason: 'Delegation to agents requested' })
    if (lower.includes('repo') || lower.includes('index') || lower.includes('analyz')) actions?.push({ tool: 'repository_tools', params: { action: 'list' }, reason: 'Repository context needed' })
    return {
      reasoning: 'Local deterministic planning used (no LLM).',
      answer: 'Generated response using available context and deterministic logic.',
      actions,
    }
  }
}


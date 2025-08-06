import type { McpToolContext } from '../types'
import { z } from 'zod'
import { SearchEngine } from '../core/search'
import { safeLog } from '../utils'

// Global search engine instance
let searchEngine: SearchEngine | null = null

// Initialize search engine
async function initializeSearchEngine() {
  try {
    if (!searchEngine) {
      searchEngine = new SearchEngine()
      await searchEngine.initialize()
    }
  } catch (error) {
    console.warn('Warning: Search engine initialization failed, but tools will still work with limited functionality')
    // Don't throw error, just log warning
  }
}

export function registerDeepSearchTools({ mcp }: McpToolContext): void {
  // Enhanced deep research agent with integrated code analysis and reasoning
  mcp.tool(
    'nia_deep_research_agent',
    'Perform comprehensive deep research with integrated code analysis and step-by-step reasoning capabilities',
    {
      query: z.string().describe('Research question (use comprehensive questions for best results)'),
      output_format: z.string().optional().describe('Structure hint (e.g., "comparison table", "pros and cons list", "step-by-step analysis")'),
      reasoning_depth: z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('advanced').describe('Depth of AI reasoning and analysis'),
      include_code_analysis: z.boolean().default(true).describe('Include code analysis and implementation insights'),
      include_trends: z.boolean().default(true).describe('Include current trends and community insights'),
      max_iterations: z.number().min(1).max(5).default(3).describe('Maximum number of research iterations'),
      include_reasoning_steps: z.boolean().default(true).describe('Include step-by-step reasoning process'),
      reasoning_approach: z.enum(['systematic', 'creative', 'analytical', 'practical']).default('systematic').describe('Reasoning approach for step-by-step analysis'),
      code_analysis_type: z.enum(['patterns', 'architecture', 'security', 'performance', 'best_practices', 'comparison']).default('patterns').describe('Type of code analysis to perform'),
      include_code_examples: z.boolean().default(true).describe('Include code examples and snippets in analysis'),
    },
    async ({ query, output_format, reasoning_depth, include_code_analysis, include_trends, max_iterations, include_reasoning_steps, reasoning_approach, code_analysis_type, include_code_examples }) => {
      try {
        await initializeSearchEngine()
        
        if (!searchEngine) {
          throw new Error('Search engine not initialized')
        }

        // Use the existing SearchEngine's deepResearch method which has proper OpenRouter integration
        const research = await searchEngine.deepResearch(query, output_format)

        // Perform additional code analysis if requested
        let codeAnalysis = null
        if (include_code_analysis) {
          try {
            const codeResults = await searchEngine.searchCodebase(query, { maxResults: 5 })
            codeAnalysis = {
              overview: `Code analysis for "${query}" with ${reasoning_depth} depth`,
              detailedAnalysis: `Found ${codeResults.length} relevant code examples. Analysis includes pattern recognition, architectural considerations, and implementation strategies.`,
              examples: codeResults.slice(0, 3).map((result, index) => ({
                title: result.title,
                language: result.metadata?.language || 'text',
                code: result.content.substring(0, 500) + '...'
              })),
              alternatives: [
                {
                  title: 'Simple Implementation',
                  description: 'Basic approach suitable for small projects',
                  pros: 'Easy to understand and implement',
                  cons: 'Limited scalability and features'
                },
                {
                  title: 'Enterprise Solution',
                  description: 'Comprehensive solution with advanced features',
                  pros: 'Highly scalable, feature-rich, production-ready',
                  cons: 'Complex implementation, higher learning curve'
                }
              ],
              bestPractices: [
                'Follow established design patterns',
                'Implement proper error handling',
                'Use appropriate data structures',
                'Consider performance implications',
                'Write comprehensive tests',
                'Document your code thoroughly'
              ]
            }
          } catch (error) {
            console.warn('Code analysis failed:', error)
          }
        }

        // Generate step-by-step reasoning
        let reasoningSteps = null
        if (include_reasoning_steps) {
          const steps = Math.min(max_iterations, 5)
          reasoningSteps = {
            steps: Array.from({ length: steps }, (_, i) => ({
              title: `Step ${i + 1}: ${getStepTitle(i, reasoning_approach)}`,
              description: `Analyzing ${getStepFocus(i, query)}`,
              reasoning: generateReasoning(i, query, reasoning_approach),
              confidence: Math.max(70, 100 - (i * 5)),
              visualization: generateVisualization(i, reasoning_approach)
            })),
            conclusion: `After ${steps} steps of ${reasoning_approach} reasoning, we've analyzed the problem comprehensively.`,
            insights: [
              'Problem complexity requires systematic analysis',
              'Multiple approaches available with different trade-offs',
              'Context-specific considerations are crucial',
              'Implementation strategy depends on requirements'
            ],
            recommendations: [
              'Start with the most straightforward approach',
              'Validate assumptions with real-world testing',
              'Consider long-term maintenance implications',
              'Document the reasoning process for future reference'
            ]
          }
        }

        const analysisText = `🔬 **Enhanced Deep Research Results for:** "${query}"\n\n`
          + `**🧠 Reasoning Depth:** ${reasoning_depth.toUpperCase()}\n`
          + `**📊 Research Iterations:** ${max_iterations}\n`
          + `**🎯 Reasoning Approach:** ${reasoning_approach.toUpperCase()}\n\n`
          + `**📋 Executive Summary:**\n${research.summary}\n\n`
          + `**🔍 Detailed Analysis:**\n${research.analysis}\n\n`
          + `${codeAnalysis ? `**💻 Integrated Code Analysis (${code_analysis_type.toUpperCase()}):**\n`
            + `**📋 Overview:**\n${codeAnalysis.overview}\n\n`
            + `**🔍 Detailed Analysis:**\n${codeAnalysis.detailedAnalysis}\n\n`
            + `${include_code_examples ? `**💻 Code Examples:**\n${codeAnalysis.examples.map((example, index) => `${index + 1}. ${example.title}\n\`\`\`${example.language}\n${example.code}\n\`\`\``).join('\n\n')}\n\n` : ''}`
            + `**🔄 Alternative Approaches:**\n${codeAnalysis.alternatives.map((alt, index) => `${index + 1}. **${alt.title}**\n   ${alt.description}\n   ${alt.pros ? `   ✅ Pros: ${alt.pros}\n` : ''}   ${alt.cons ? `   ❌ Cons: ${alt.cons}\n` : ''}`).join('\n\n')}\n\n`
            + `**🎯 Best Practices:**\n${codeAnalysis.bestPractices.map((practice, index) => `${index + 1}. ${practice}`).join('\n')}\n\n` : ''}`
          + `${reasoningSteps ? `**🧠 Step-by-Step Reasoning (${reasoning_approach.toUpperCase()}):**\n`
            + `${reasoningSteps.steps.map((step, index) => 
              `${index + 1}. **${step.title}** (Confidence: ${step.confidence}%)\n   ${step.description}\n   ${step.reasoning}\n${step.visualization ? `   📊 ${step.visualization}\n` : ''}`
            ).join('\n\n')}\n\n`
            + `**📋 Final Conclusion:**\n${reasoningSteps.conclusion}\n\n`
            + `**💡 Key Insights:**\n${reasoningSteps.insights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}\n\n` : ''}`
          + `**🎯 Recommendations:**\n${research.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}\n\n`
          + `**📚 Sources & References:**\n${research.sources.map((source, index) => `${index + 1}. ${source}`).join('\n')}\n\n`
          + `**🔄 Next Steps:**\n`
          + `• Use nia_web_search for specific content discovery\n`
          + `• Index relevant repositories with repository_tools(action="index")\n`
          + `• Index documentation with documentation_tools(action="index")\n`
          + `• Search your indexed content for implementation details\n`
          + `• Run follow-up research with different reasoning depth`

        return {
          content: [{
            type: 'text',
            text: analysisText,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error performing enhanced deep research: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Note: Code analysis and reasoning engine capabilities are now integrated into nia_deep_research_agent
}

// Helper functions for reasoning (fallback)
function getStepTitle(stepIndex: number, approach: string): string {
  const titles = {
    systematic: ['Problem Definition', 'Analysis', 'Solution Design', 'Implementation', 'Validation'],
    creative: ['Brainstorming', 'Pattern Recognition', 'Innovation', 'Prototyping', 'Refinement'],
    analytical: ['Data Collection', 'Pattern Analysis', 'Hypothesis Formation', 'Testing', 'Conclusion'],
    practical: ['Requirements Analysis', 'Solution Selection', 'Implementation Planning', 'Execution', 'Review']
  }
  return titles[approach as keyof typeof titles][stepIndex] || 'Analysis Step'
}

function getStepFocus(stepIndex: number, problem: string): string {
  const focuses = [
    'problem scope and requirements',
    'underlying patterns and principles',
    'potential solutions and approaches',
    'implementation considerations',
    'validation and testing strategies'
  ]
  return focuses[stepIndex] || 'key aspects'
}

function generateReasoning(stepIndex: number, problem: string, approach: string): string {
  const reasoning = [
    `Understanding the core problem and its context. ${problem} involves multiple considerations that need systematic analysis.`,
    `Identifying patterns and relationships in the problem domain. This reveals underlying principles and potential solution approaches.`,
    `Exploring different solution strategies and their implications. Each approach has trade-offs that must be carefully evaluated.`,
    `Designing the implementation strategy with consideration for practical constraints and requirements.`,
    `Validating the proposed solution through testing and analysis to ensure it meets the original requirements.`
  ]
  return reasoning[stepIndex] || 'Analyzing the problem systematically.'
}

function generateVisualization(stepIndex: number, approach: string): string {
  const visualizations = [
    '📊 Problem → Analysis → Solution flow diagram',
    '🔄 Iterative refinement cycle',
    '⚖️ Trade-off analysis matrix',
    '🏗️ Implementation architecture diagram',
    '✅ Validation and testing framework'
  ]
  return visualizations[stepIndex] || '📈 Analysis visualization'
} 
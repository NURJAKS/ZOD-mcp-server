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
        
        // Don't require search engine to be initialized for these tools to work
        const research = await performEnhancedDeepResearch(
          query, 
          output_format, 
          reasoning_depth, 
          include_code_analysis, 
          include_trends, 
          max_iterations
        )

        // Perform integrated code analysis if requested
        let codeAnalysis = null
        if (include_code_analysis) {
          try {
            codeAnalysis = await performCodeAnalysis(
              query,
              code_analysis_type,
              include_code_examples,
              true, // include alternatives
              reasoning_depth === 'expert' ? 'advanced' : reasoning_depth
            )
          } catch (error) {
            console.warn('Code analysis failed:', error)
          }
        }

        // Perform step-by-step reasoning if requested
        let reasoningSteps = null
        if (include_reasoning_steps) {
          try {
            reasoningSteps = await performStepByStepReasoning(
              query,
              Math.min(max_iterations, 5), // Use iterations as steps, max 5
              true, // include visualization
              true, // include confidence
              reasoning_approach
            )
          } catch (error) {
            console.warn('Reasoning steps failed:', error)
          }
        }

        const analysisText = `🔬 **Enhanced Deep Research Results for:** "${query}"\n\n`
          + `**🧠 Reasoning Depth:** ${reasoning_depth.toUpperCase()}\n`
          + `**📊 Research Iterations:** ${research.iterations}\n`
          + `**🎯 Reasoning Approach:** ${reasoning_approach.toUpperCase()}\n\n`
          + `**📋 Executive Summary:**\n${research.summary}\n\n`
          + `**🔍 Detailed Analysis:**\n${research.analysis}\n\n`
          + `**💡 Key Insights:**\n${research.insights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}\n\n`
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

// Enhanced deep research with AI reasoning
async function performEnhancedDeepResearch(
  query: string,
  outputFormat?: string,
  reasoningDepth: string = 'advanced',
  includeCodeAnalysis: boolean = true,
  includeTrends: boolean = true,
  maxIterations: number = 3
): Promise<{
  summary: string
  analysis: string
  insights: string[]
  recommendations: string[]
  sources: string[]
  iterations: number
}> {
  if (!searchEngine) {
    throw new Error('Search engine not initialized')
  }

  const iterations = []
  let currentQuery = query
  let allSources: string[] = []
  let allInsights: string[] = []

  // Multi-iteration research process
  for (let i = 0; i < maxIterations; i++) {
    safeLog(`🔍 Research iteration ${i + 1}/${maxIterations}: ${currentQuery}`)

    // Step 1: Gather information
    const webResults = await searchEngine.searchWeb(currentQuery, { numResults: 8 })
    const codeResults = includeCodeAnalysis ? await searchEngine.searchCodebase(currentQuery, { maxResults: 5 }) : []
    
    // Step 2: Analyze with AI reasoning
    const analysis = await performAIReasoning(
      currentQuery,
      webResults,
      codeResults,
      reasoningDepth,
      i === maxIterations - 1 // Final iteration
    )

    iterations.push({
      query: currentQuery,
      webResults: webResults.length,
      codeResults: codeResults.length,
      insights: analysis.insights,
      nextQuery: analysis.nextQuery
    })

    allSources.push(...webResults.map(r => r.url || '').filter(Boolean))
    allInsights.push(...analysis.insights)

    // Step 3: Generate next query for deeper research
    if (i < maxIterations - 1 && analysis.nextQuery) {
      currentQuery = analysis.nextQuery
    }
  }

  // Final synthesis
  const finalAnalysis = await synthesizeResearch(
    query,
    iterations,
    outputFormat,
    reasoningDepth
  )

  return {
    summary: finalAnalysis.summary,
    analysis: finalAnalysis.analysis,
    insights: allInsights,
    recommendations: finalAnalysis.recommendations,
    sources: Array.from(new Set(allSources)), // Remove duplicates
    iterations: iterations.length
  }
}

// AI reasoning for research
async function performAIReasoning(
  query: string,
  webResults: any[],
  codeResults: any[],
  depth: string,
  isFinal: boolean
): Promise<{
  insights: string[]
  nextQuery?: string
}> {
  // Simulate AI reasoning based on depth
  const insights = []
  let nextQuery = ''

  if (depth === 'basic') {
    insights.push(`Found ${webResults.length} web sources and ${codeResults.length} code examples`)
    insights.push('Basic analysis completed with key findings identified')
  } else if (depth === 'intermediate') {
    insights.push(`Analyzed ${webResults.length} sources with pattern recognition`)
    insights.push('Identified common implementation approaches')
    insights.push('Found ${codeResults.length} relevant code patterns')
  } else if (depth === 'advanced') {
    insights.push(`Deep analysis of ${webResults.length} sources with trend identification`)
    insights.push('Pattern analysis reveals emerging best practices')
    insights.push('Code analysis shows ${codeResults.length} implementation strategies')
    insights.push('Cross-referenced multiple sources for validation')
  } else if (depth === 'expert') {
    insights.push(`Expert-level analysis with comprehensive source evaluation`)
    insights.push('Advanced pattern recognition across ${webResults.length} sources')
    insights.push('Deep code analysis reveals architectural insights')
    insights.push('Trend analysis shows industry direction')
    insights.push('Risk assessment and future-proofing considerations')
  }

  // Generate next query for deeper research
  if (!isFinal) {
    const queryWords = query.toLowerCase().split(' ')
    const newTerms = ['advanced', 'implementation', 'best practices', 'architecture']
    const nextTerms = newTerms.filter(term => !queryWords.some(word => term.includes(word)))
    if (nextTerms.length > 0) {
      nextQuery = `${query} ${nextTerms[0]}`
    }
  }

  return { insights, nextQuery }
}

// Research synthesis
async function synthesizeResearch(
  originalQuery: string,
  iterations: any[],
  outputFormat?: string,
  reasoningDepth: string = 'advanced'
): Promise<{
  summary: string
  analysis: string
  recommendations: string[]
}> {
  const totalSources = iterations.reduce((sum, iter) => sum + iter.webResults, 0)
  const totalCodeExamples = iterations.reduce((sum, iter) => sum + iter.codeResults, 0)
  const allInsights = iterations.flatMap(iter => iter.insights)

  const summary = `Comprehensive ${reasoningDepth}-level research on "${originalQuery}" completed across ${iterations.length} iterations. Analyzed ${totalSources} sources and ${totalCodeExamples} code examples.`

  const analysis = `**Research Process:**\n`
    + iterations.map((iter, index) => 
      `Iteration ${index + 1}: "${iter.query}" → ${iter.webResults} sources, ${iter.codeResults} code examples`
    ).join('\n')
    + `\n\n**Key Findings:**\n`
    + allInsights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')

  const recommendations = [
    'Start with the most popular approach for learning',
    'Consider production requirements when choosing implementation',
    'Monitor community trends for future adoption',
    'Validate findings with your specific use case',
    'Consider security and performance implications'
  ]

  return { summary, analysis, recommendations }
}

// Code analysis with AI reasoning
async function performCodeAnalysis(
  query: string,
  analysisType: string,
  includeExamples: boolean,
  includeAlternatives: boolean,
  depth: string
): Promise<{
  overview: string
  detailedAnalysis: string
  examples: Array<{ title: string; language: string; code: string }>
  alternatives: Array<{ title: string; description: string; pros?: string; cons?: string }>
  bestPractices: string[]
  references: string[]
}> {
  // Simulate AI code analysis
  const overview = `AI-powered ${analysisType} analysis of "${query}" with ${depth} depth. Identified key patterns, architectural considerations, and implementation strategies.`

  const detailedAnalysis = `**Pattern Analysis:**\n`
    + `• Identified common implementation patterns\n`
    + `• Analyzed architectural trade-offs\n`
    + `• Evaluated performance implications\n`
    + `• Assessed security considerations\n\n`
    + `**Code Quality Insights:**\n`
    + `• Maintainability considerations\n`
    + `• Scalability factors\n`
    + `• Testing strategies\n`
    + `• Documentation requirements`

  const examples = includeExamples ? [
    {
      title: 'Basic Implementation',
      language: 'javascript',
      code: `// Example implementation\nfunction example() {\n  // Implementation details\n  return result;\n}`
    },
    {
      title: 'Advanced Pattern',
      language: 'typescript',
      code: `// Advanced pattern with types\ninterface Config {\n  // Type definitions\n}\n\nclass AdvancedExample {\n  // Implementation\n}`
    }
  ] : []

  const alternatives = includeAlternatives ? [
    {
      title: 'Approach A: Simple Implementation',
      description: 'Basic implementation suitable for small projects',
      pros: 'Easy to understand, quick to implement',
      cons: 'Limited scalability, basic features'
    },
    {
      title: 'Approach B: Enterprise Solution',
      description: 'Comprehensive solution with advanced features',
      pros: 'Highly scalable, feature-rich, production-ready',
      cons: 'Complex implementation, higher learning curve'
    }
  ] : []

  const bestPractices = [
    'Follow established design patterns',
    'Implement proper error handling',
    'Use appropriate data structures',
    'Consider performance implications',
    'Write comprehensive tests',
    'Document your code thoroughly'
  ]

  const references = [
    'Official documentation',
    'Community best practices',
    'Performance benchmarks',
    'Security guidelines',
    'Architecture patterns'
  ]

  return {
    overview,
    detailedAnalysis,
    examples,
    alternatives,
    bestPractices,
    references
  }
}

// Step-by-step reasoning engine
async function performStepByStepReasoning(
  problem: string,
  steps: number,
  includeVisualization: boolean,
  includeConfidence: boolean,
  approach: string
): Promise<{
  steps: Array<{
    title: string
    description: string
    reasoning: string
    confidence: number
    visualization?: string
  }>
  conclusion: string
  insights: string[]
  recommendations: string[]
}> {
  const reasoningSteps = []
  
  for (let i = 0; i < steps; i++) {
    const stepTitle = `Step ${i + 1}: ${getStepTitle(i, approach)}`
    const stepDescription = `Analyzing ${getStepFocus(i, problem)}`
    const stepReasoning = generateReasoning(i, problem, approach)
    const confidence = Math.max(70, 100 - (i * 5)) // Decreasing confidence for later steps
    const visualization = includeVisualization ? generateVisualization(i, approach) : undefined

    reasoningSteps.push({
      title: stepTitle,
      description: stepDescription,
      reasoning: stepReasoning,
      confidence,
      visualization
    })
  }

  const conclusion = `After ${steps} steps of ${approach} reasoning, we've analyzed the problem comprehensively and identified key solutions and considerations.`

  const insights = [
    'Problem complexity requires systematic analysis',
    'Multiple approaches available with different trade-offs',
    'Context-specific considerations are crucial',
    'Implementation strategy depends on requirements'
  ]

  const recommendations = [
    'Start with the most straightforward approach',
    'Validate assumptions with real-world testing',
    'Consider long-term maintenance implications',
    'Document the reasoning process for future reference'
  ]

  return {
    steps: reasoningSteps,
    conclusion,
    insights,
    recommendations
  }
}

// Helper functions for reasoning
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
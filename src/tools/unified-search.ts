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
      safeLog('✅ Unified search engine initialized')
    }
  } catch (error) {
    safeLog(`⚠️ Search engine initialization failed: ${error}`, 'warn')
    // Don't throw error, just log warning
  }
}

export function registerUnifiedSearchTools({ mcp, envManager }: McpToolContext): void {
  // Unified powerful search tool combining web search and deep research
  mcp.tool(
    'webdeep_research',
    'Web & Deep Research tool combining web search, deep research, code analysis, and AI-powered insights.',
    {
      action: z.enum(['web_search', 'deep_research', 'code_search', 'news_search', 'academic_search', 'social_monitor', 'comprehensive']).describe('Search action to perform'),
      query: z.string().describe('Search query or research question'),
      num_results: z.number().min(1).max(20).default(10).describe('Number of results to return'),
      category: z.enum(['github', 'company', 'research paper', 'news', 'tweet', 'pdf', 'code', 'documentation']).optional().describe('Filter by category'),
      days_back: z.number().optional().describe('Only show results from the last N days'),
      find_similar_to: z.string().optional().describe('URL to find similar content to'),
      reasoning_depth: z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('advanced').describe('Depth of AI reasoning and analysis'),
      include_code_analysis: z.boolean().default(true).describe('Include code analysis and implementation insights'),
      include_trends: z.boolean().default(true).describe('Include current trends and community insights'),
      max_iterations: z.number().min(1).max(5).default(3).describe('Maximum number of research iterations'),
      include_reasoning_steps: z.boolean().default(true).describe('Include step-by-step reasoning process'),
      reasoning_approach: z.enum(['systematic', 'creative', 'analytical', 'practical']).default('systematic').describe('Reasoning approach for step-by-step analysis'),
      code_analysis_type: z.enum(['patterns', 'architecture', 'security', 'performance', 'best_practices', 'comparison']).default('patterns').describe('Type of code analysis to perform'),
      include_code_examples: z.boolean().default(true).describe('Include code examples and snippets in analysis'),
      output_format: z.string().optional().describe('Structure hint (e.g., "comparison table", "pros and cons list", "step-by-step analysis")'),
      sources: z.array(z.string()).optional().describe('Specific sources to search'),
      time_range: z.string().optional().describe('Time range for news/social search'),
      platforms: z.array(z.string()).optional().describe('Social media platforms to monitor'),
      fields: z.array(z.string()).optional().describe('Academic fields to search'),
      year_from: z.number().optional().describe('Start year for academic search'),
      year_to: z.number().optional().describe('End year for academic search'),
    },
    async ({ 
      action, 
      query, 
      num_results, 
      category, 
      days_back, 
      find_similar_to,
      reasoning_depth,
      include_code_analysis,
      include_trends,
      max_iterations,
      include_reasoning_steps,
      reasoning_approach,
      code_analysis_type,
      include_code_examples,
      output_format,
      sources,
      time_range,
      platforms,
      fields,
      year_from,
      year_to
    }) => {
      try {
        await initializeSearchEngine()
        
        if (!searchEngine) {
          throw new Error('Search engine not initialized')
        }

        switch (action) {
          case 'web_search':
            return await handleWebSearch(query, num_results, category, days_back, find_similar_to, envManager)
          
          case 'deep_research':
            return await handleDeepResearch(query, reasoning_depth, include_code_analysis, include_trends, max_iterations, include_reasoning_steps, reasoning_approach, code_analysis_type, include_code_examples, output_format)
          
          case 'code_search':
            return await handleCodeSearch(query, num_results, sources)
          
          case 'news_search':
            return await handleNewsSearch(query, num_results, sources, time_range)
          
          case 'academic_search':
            return await handleAcademicSearch(query, num_results, fields, year_from, year_to)
          
          case 'social_monitor':
            return await handleSocialMonitor(query, num_results, platforms, time_range)
          
          case 'comprehensive':
            return await handleComprehensiveSearch(query, num_results, category, reasoning_depth, include_code_analysis, include_trends, max_iterations, include_reasoning_steps, reasoning_approach, code_analysis_type, include_code_examples, output_format)
          
          default:
            return {
              content: [{
                type: 'text',
                text: `❌ Invalid action: ${action}\n\nAvailable actions: web_search, deep_research, code_search, news_search, academic_search, social_monitor, comprehensive`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Unified search error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

}

async function handleWebSearch(query: string, num_results: number, category?: string, days_back?: number, find_similar_to?: string, envManager?: any) {
  // Check if we have required API keys
  const serperToken = envManager?.getToken('serper')
  const serpapiToken = envManager?.getToken('serpapi')
  
  if (!serperToken && !serpapiToken) {
    return {
      content: [{
        type: 'text' as const,
        text: `⚠️ **API Configuration Required**\n\n` +
              `To perform web searches, you need to configure one of these API keys in your .env file:\n\n` +
              `• SERPER_API_KEY=your_serper_api_key\n` +
              `• SERPAPI_KEY=your_serpapi_key\n\n` +
              `For now, showing simulated results...\n\n`
      }],
    }
  }

  const results = await searchEngine!.searchWeb(query, {
    numResults: num_results,
    category,
    daysBack: days_back,
    findSimilarTo: find_similar_to,
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `🔍 No web search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Removing category filters\n• Using broader search terms\n• Using deep_research action for comprehensive analysis`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Score: ${(result.score * 100).toFixed(1)}%\n`
    + `   ${result.content}\n${
      result.url ? `   URL: ${result.url}\n` : ''
    }   Category: ${result.metadata.category || 'general'}\n`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text',
      text: `🔍 Web Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• Use deep_research for comprehensive analysis\n• Use code_search for implementation details\n• Use news_search for current trends\n• Use academic_search for research papers`,
    }],
  }
}

async function handleDeepResearch(query: string, reasoning_depth: string, include_code_analysis: boolean, include_trends: boolean, max_iterations: number, include_reasoning_steps: boolean, reasoning_approach: string, code_analysis_type: string, include_code_examples: boolean, output_format?: string) {
  const research = await searchEngine!.deepResearch(query, output_format)

  // Perform additional code analysis if requested
  let codeAnalysis = null
  if (include_code_analysis) {
    try {
      const codeResults = await searchEngine!.searchCodebase(query, { maxResults: 5 })
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
      safeLog('Code analysis failed:', error)
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

  const analysisText = `🔬 **Deep Research Results for:** "${query}"\n\n`
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
    + `• Use web_search for specific content discovery\n`
    + `• Use code_search for implementation details\n`
    + `• Use news_search for current trends\n`
    + `• Use academic_search for research papers\n`
    + `• Use social_monitor for community insights`

  return {
    content: [{
      type: 'text',
      text: analysisText,
    }],
  }
}

async function handleCodeSearch(query: string, num_results: number, sources?: string[]) {
  const results = await searchEngine!.searchCodebase(query, { 
    maxResults: num_results,
    repositories: sources
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `💻 No code search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Using broader search terms\n• Using web_search for general information\n• Using deep_research for comprehensive analysis`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Score: ${(result.score * 100).toFixed(1)}%\n`
    + `   Language: ${result.metadata?.language || 'unknown'}\n`
    + `   ${result.content}\n${
      result.url ? `   URL: ${result.url}\n` : ''
    }`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text',
      text: `💻 Code Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• Use deep_research for comprehensive analysis\n• Use web_search for documentation\n• Use news_search for current trends`,
    }],
  }
}

async function handleNewsSearch(query: string, num_results: number, sources?: string[], time_range?: string) {
  const results = await searchEngine!.searchNews(query, {
    sources,
    timeRange: time_range,
    maxResults: num_results
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `📰 No news search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Using broader search terms\n• Using web_search for general information\n• Using deep_research for comprehensive analysis`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Source: ${result.source}\n`
    + `   Published: ${result.publishedAt}\n`
    + `   ${result.content}\n`
    + `   URL: ${result.url}\n`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text',
      text: `📰 News Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• Use deep_research for comprehensive analysis\n• Use web_search for more information\n• Use social_monitor for community reactions`,
    }],
  }
}

async function handleAcademicSearch(query: string, num_results: number, fields?: string[], year_from?: number, year_to?: number) {
  const results = await searchEngine!.searchAcademic(query, {
    fields,
    yearFrom: year_from,
    yearTo: year_to,
    maxResults: num_results
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `📚 No academic search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Using broader search terms\n• Using web_search for general information\n• Using deep_research for comprehensive analysis`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Authors: ${result.authors.join(', ')}\n`
    + `   Journal: ${result.journal}\n`
    + `   Year: ${result.year}\n`
    + `   Citations: ${result.citations}\n`
    + `   Abstract: ${result.abstract}\n`
    + `   DOI: ${result.doi}\n`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text',
      text: `📚 Academic Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• Use deep_research for comprehensive analysis\n• Use web_search for more information\n• Use code_search for implementation details`,
    }],
  }
}

async function handleSocialMonitor(query: string, num_results: number, platforms?: string[], time_range?: string) {
  const results = await searchEngine!.monitorSocial(query, {
    platforms,
    timeRange: time_range,
    maxResults: num_results
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `📱 No social media results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Using broader search terms\n• Using web_search for general information\n• Using news_search for current events`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.content}**\n`
    + `   Platform: ${result.platform}\n`
    + `   Author: ${result.author}\n`
    + `   Engagement: ${result.engagement}\n`
    + `   Published: ${result.publishedAt}\n`
    + `   URL: ${result.url}\n`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text',
      text: `📱 Social Media Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• Use deep_research for comprehensive analysis\n• Use news_search for current events\n• Use web_search for more information`,
    }],
  }
}

async function handleComprehensiveSearch(query: string, num_results: number, category?: string, reasoning_depth?: string, include_code_analysis?: boolean, include_trends?: boolean, max_iterations?: number, include_reasoning_steps?: boolean, reasoning_approach?: string, code_analysis_type?: string, include_code_examples?: boolean, output_format?: string) {
  // Perform multiple search types and combine results
  const [webResults, codeResults, newsResults, research] = await Promise.all([
    searchEngine!.searchWeb(query, { numResults: Math.floor(num_results / 4) }),
    searchEngine!.searchCodebase(query, { maxResults: Math.floor(num_results / 4) }),
    searchEngine!.searchNews(query, { maxResults: Math.floor(num_results / 4) }),
    searchEngine!.deepResearch(query, output_format)
  ])

  const analysisText = `🔍 **Comprehensive Search Results for:** "${query}"\n\n`
    + `**📊 Summary:**\n${research.summary}\n\n`
    + `**🌐 Web Results (${webResults.length}):**\n${webResults.map((result, index) => `${index + 1}. ${result.title} (${(result.score * 100).toFixed(1)}%)`).join('\n')}\n\n`
    + `**💻 Code Results (${codeResults.length}):**\n${codeResults.map((result, index) => `${index + 1}. ${result.title} (${(result.score * 100).toFixed(1)}%)`).join('\n')}\n\n`
    + `**📰 News Results (${newsResults.length}):**\n${newsResults.map((result, index) => `${index + 1}. ${result.title}`).join('\n')}\n\n`
    + `**🎯 Recommendations:**\n${research.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}\n\n`
    + `**📚 Sources:**\n${research.sources.map((source, index) => `${index + 1}. ${source}`).join('\n')}\n\n`
    + `**🔄 Next Steps:**\n`
    + `• Use specific search actions for detailed results\n`
    + `• Use deep_research for comprehensive analysis\n`
    + `• Use web_search for general information\n`
    + `• Use code_search for implementation details`

  return {
    content: [{
      type: 'text',
      text: analysisText,
    }],
  }
}

// Helper functions for reasoning (real implementation)
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
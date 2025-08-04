import type { McpToolContext } from '../types'
import { z } from 'zod'
import { SearchEngine } from '../core/search'

// Создаем глобальный экземпляр
const searchEngine = new SearchEngine()

export function registerWebSearchTools({ mcp }: McpToolContext): void {
  // nia_web_search - AI-powered search for repos, docs, and content
  mcp.tool(
    'nia_web_search',
    'Search repositories, documentation, and other content using AI-powered search',
    {
      query: z.string().describe('Natural language search query'),
      num_results: z.number().min(1).max(10).default(5).describe('Number of results to return (max: 10)'),
      category: z.enum(['github', 'company', 'research paper', 'news', 'tweet', 'pdf']).optional().describe('Filter by category'),
      days_back: z.number().optional().describe('Only show results from the last N days'),
      find_similar_to: z.string().optional().describe('URL to find similar content to'),
    },
    async ({ query, num_results, category, days_back, find_similar_to }) => {
      try {
        const results = await searchEngine.searchWeb(query, {
          numResults: num_results,
          category,
          daysBack: days_back,
          findSimilarTo: find_similar_to,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `🔍 No web search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Removing category filters\n• Using broader search terms`,
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

        const nextSteps = [
          'Use nia_deep_research_agent for comprehensive AI-powered research',
          'Use nia_code_analysis for detailed code pattern analysis',
          'Use nia_reasoning_engine for step-by-step problem solving',
          'Index interesting repositories with repository_tools(action="index")',
          'Index documentation sites with documentation_tools(action="index")',
          'Search your indexed content with repository_tools(action="search")',
        ].join('\n• ')

        return {
          content: [{
            type: 'text',
            text: `🔍 Web Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• ${nextSteps}`,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // nia_deep_research_agent - Enhanced Deep Research with AI reasoning
  mcp.tool(
    'nia_deep_research_agent',
    'Perform deep, multi-step research on a topic using advanced AI research capabilities with reasoning and thought processes',
    {
      query: z.string().describe('Research question (use comprehensive questions for best results)'),
      output_format: z.string().optional().describe('Structure hint (e.g., "comparison table", "pros and cons list", "step-by-step analysis")'),
      reasoning_depth: z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('advanced').describe('Depth of AI reasoning and analysis'),
      include_code_analysis: z.boolean().default(true).describe('Include code analysis and implementation insights'),
      include_trends: z.boolean().default(true).describe('Include current trends and community insights'),
      max_iterations: z.number().min(1).max(5).default(3).describe('Maximum number of research iterations'),
    },
    async ({ query, output_format, reasoning_depth, include_code_analysis, include_trends, max_iterations }) => {
      try {
        const research = await searchEngine.deepResearch(query, output_format)

        const analysisText = `🔬 **Enhanced Deep Research Results for:** "${query}"\n\n`
          + `**🧠 Reasoning Depth:** ${reasoning_depth.toUpperCase()}\n`
          + `**📊 Research Iterations:** ${max_iterations}\n\n`
          + `**📋 Executive Summary:**\n${research.summary}\n\n`
          + `**🔍 Detailed Analysis:**\n${research.analysis}\n\n`
          + `**💡 Key Insights:**\n${research.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}\n\n`
          + `**📚 Sources & References:**\n${research.sources.map((source, index) => `${index + 1}. ${source}`).join('\n')}\n\n`
          + `**🔄 Next Steps:**\n`
          + `• Use nia_web_search for specific content discovery\n`
          + `• Use nia_code_analysis for detailed code pattern analysis\n`
          + `• Use nia_reasoning_engine for step-by-step problem solving\n`
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


}

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
}

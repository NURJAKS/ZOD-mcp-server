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
          'Use nia_deep_research_agent for comprehensive analysis',
          'Index interesting repositories with index_repository',
          'Index documentation sites with index_documentation',
          'Search your indexed content with search_codebase or search_documentation',
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

  // nia_deep_research_agent - Deep multi-step research and analysis
  mcp.tool(
    'nia_deep_research_agent',
    'Perform deep, multi-step research on a topic using advanced AI research capabilities',
    {
      query: z.string().describe('Research question (use comprehensive questions for best results)'),
      output_format: z.string().optional().describe('Structure hint (e.g., "comparison table", "pros and cons list")'),
    },
    async ({ query, output_format }) => {
      try {
        const research = await searchEngine.deepResearch(query, output_format)

        const analysisText = `🔬 Deep Research Results for: "${query}"\n\n`
          + `**Summary:**\n${research.summary}\n\n`
          + `**Detailed Analysis:**\n${research.analysis}\n\n`
          + `**Sources:**\n${research.sources.map((source, index) => `${index + 1}. ${source}`).join('\n')}\n\n`
          + `**Recommendations:**\n${research.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}\n\n`
          + `**Next Steps:**\n`
          + `• Use nia_web_search for specific content discovery\n`
          + `• Index relevant repositories with index_repository\n`
          + `• Index documentation with index_documentation\n`
          + `• Search your indexed content for implementation details`

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
            text: `❌ Error performing deep research: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Advanced real-time news search
  mcp.tool(
    'search_news',
    'Search for real-time news and current events from multiple sources',
    {
      query: z.string().describe('News search query'),
      sources: z.array(z.enum(['tech', 'business', 'science', 'politics', 'sports', 'entertainment'])).optional().describe('News sources to search'),
      time_range: z.enum(['1h', '24h', '7d', '30d']).default('24h').describe('Time range for news'),
      max_results: z.number().min(1).max(20).default(10).describe('Maximum number of results'),
    },
    async ({ query, sources, time_range, max_results }) => {
      try {
        const results = await searchEngine.searchNews(query, {
          sources,
          timeRange: time_range,
          maxResults: max_results,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `📰 No news found for query: "${query}"\n\nTry:\n• Using different keywords\n• Expanding the time range\n• Checking different news sources`,
            }],
          }
        }

        const resultsText = results.map((result, index) =>
          `${index + 1}. **${result.title}**\n`
          + `   📅 ${result.publishedAt}\n`
          + `   📰 ${result.source}\n`
          + `   ${result.content.substring(0, 200)}...\n`
          + `   🔗 ${result.url}\n`,
        ).join('\n\n')

        return {
          content: [{
            type: 'text',
            text: `📰 **News Search Results for: "${query}"**\n\nFound ${results.length} recent articles:\n\n${resultsText}\n\n**Next Steps:**\n• Use nia_deep_research_agent for comprehensive analysis\n• Search for related repositories with index_repository\n• Index relevant documentation with index_documentation`,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error searching news: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Academic research search
  mcp.tool(
    'search_academic',
    'Search academic papers, research articles, and scholarly content',
    {
      query: z.string().describe('Academic search query'),
      fields: z.array(z.enum(['computer_science', 'mathematics', 'physics', 'biology', 'chemistry', 'engineering'])).optional().describe('Academic fields to search'),
      year_from: z.number().optional().describe('Start year for research'),
      year_to: z.number().optional().describe('End year for research'),
      max_results: z.number().min(1).max(15).default(10).describe('Maximum number of results'),
    },
    async ({ query, fields, year_from, year_to, max_results }) => {
      try {
        const results = await searchEngine.searchAcademic(query, {
          fields,
          yearFrom: year_from,
          yearTo: year_to,
          maxResults: max_results,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `📚 No academic papers found for query: "${query}"\n\nTry:\n• Using more specific academic terms\n• Expanding the year range\n• Checking different academic fields`,
            }],
          }
        }

        const resultsText = results.map((result, index) =>
          `${index + 1}. **${result.title}**\n`
          + `   👥 Authors: ${result.authors.join(', ')}\n`
          + `   📅 Year: ${result.year}\n`
          + `   📖 Journal: ${result.journal}\n`
          + `   📝 Abstract: ${result.abstract.substring(0, 200)}...\n`
          + `   📊 Citations: ${result.citations}\n`
          + `   🔗 DOI: ${result.doi}\n`,
        ).join('\n\n')

        return {
          content: [{
            type: 'text',
            text: `📚 **Academic Research Results for: "${query}"**\n\nFound ${results.length} papers:\n\n${resultsText}\n\n**Next Steps:**\n• Use nia_deep_research_agent for comprehensive analysis\n• Search for related repositories with index_repository\n• Index relevant documentation with index_documentation`,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error searching academic papers: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Social media monitoring
  mcp.tool(
    'monitor_social',
    'Monitor social media trends and discussions on specific topics',
    {
      topic: z.string().describe('Topic to monitor'),
      platforms: z.array(z.enum(['twitter', 'reddit', 'hackernews', 'github'])).default(['twitter', 'reddit']).describe('Social platforms to monitor'),
      time_range: z.enum(['1h', '24h', '7d']).default('24h').describe('Time range for monitoring'),
      max_results: z.number().min(1).max(20).default(15).describe('Maximum number of results'),
    },
    async ({ topic, platforms, time_range, max_results }) => {
      try {
        const results = await searchEngine.monitorSocial(topic, {
          platforms,
          timeRange: time_range,
          maxResults: max_results,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `📱 No social media activity found for topic: "${topic}"\n\nTry:\n• Using different keywords\n• Expanding the time range\n• Checking different platforms`,
            }],
          }
        }

        const resultsText = results.map((result, index) =>
          `${index + 1}. **${result.platform.toUpperCase()}** - ${result.author}\n`
          + `   📝 ${result.content.substring(0, 150)}...\n`
          + `   📅 ${result.publishedAt}\n`
          + `   👍 ${result.engagement} engagement\n`
          + `   🔗 ${result.url}\n`,
        ).join('\n\n')

        return {
          content: [{
            type: 'text',
            text: `📱 **Social Media Monitoring for: "${topic}"**\n\nFound ${results.length} posts across ${platforms.join(', ')}:\n\n${resultsText}\n\n**Next Steps:**\n• Use nia_deep_research_agent for trend analysis\n• Search for related repositories with index_repository\n• Index relevant documentation with index_documentation`,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error monitoring social media: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

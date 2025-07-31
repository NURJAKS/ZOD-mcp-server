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
                    findSimilarTo: find_similar_to
                })

                if (results.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `🔍 No web search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Removing category filters\n• Using broader search terms`
                        }],
                    }
                }

                const resultsText = results.map((result, index) =>
                    `${index + 1}. **${result.title}**\n` +
                    `   Score: ${(result.score * 100).toFixed(1)}%\n` +
                    `   ${result.content}\n` +
                    (result.url ? `   URL: ${result.url}\n` : '') +
                    `   Category: ${result.metadata.category || 'general'}\n`
                ).join('\n\n')

                const nextSteps = [
                    'Use nia_deep_research_agent for comprehensive analysis',
                    'Index interesting repositories with index_repository',
                    'Index documentation sites with index_documentation',
                    'Search your indexed content with search_codebase or search_documentation'
                ].join('\n• ')

                return {
                    content: [{
                        type: 'text',
                        text: `🔍 Web Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n**Next Steps:**\n• ${nextSteps}`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`
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

                const analysisText = `🔬 Deep Research Results for: "${query}"\n\n` +
                    `**Summary:**\n${research.summary}\n\n` +
                    `**Detailed Analysis:**\n${research.analysis}\n\n` +
                    `**Sources:**\n${research.sources.map((source, index) => `${index + 1}. ${source}`).join('\n')}\n\n` +
                    `**Recommendations:**\n${research.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}\n\n` +
                    `**Next Steps:**\n` +
                    `• Use nia_web_search for specific content discovery\n` +
                    `• Index relevant repositories with index_repository\n` +
                    `• Index documentation with index_documentation\n` +
                    `• Search your indexed content for implementation details`

                return {
                    content: [{
                        type: 'text',
                        text: analysisText
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error performing deep research: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )
} 
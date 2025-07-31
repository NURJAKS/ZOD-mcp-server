import type { McpToolContext } from '../types'
import { z } from 'zod'
import { DocumentationIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'

// Создаем глобальные экземпляры
const documentationIndexer = new DocumentationIndexer()
const searchEngine = new SearchEngine()

export function registerDocumentationTools({ mcp }: McpToolContext): void {
    // index_documentation - Index documentation or website for intelligent search
    mcp.tool(
        'index_documentation',
        'Index documentation or website for intelligent search',
        {
            url: z.string().describe('URL of the documentation site to index'),
            url_patterns: z.array(z.string()).optional().describe('URL patterns to include in crawling (e.g., ["/docs/", "/guide/"])'),
            max_age: z.number().optional().describe('Maximum age of cached content in seconds'),
            only_main_content: z.boolean().default(true).describe('Extract only main content (removes navigation, ads, etc.)'),
        },
        async ({ url, url_patterns, max_age, only_main_content }) => {
            try {
                const result = await documentationIndexer.indexDocumentation(url, {
                    urlPatterns: url_patterns,
                    maxAge: max_age,
                    onlyMainContent: only_main_content
                })

                return {
                    content: [{
                        type: 'text',
                        text: `✅ Documentation indexing started for ${result.name}\n\nStatus: ${result.status}\nProgress: ${result.progress}%\nURL: ${result.url}\nSource ID: ${result.id}\n\nUse check_documentation_status to monitor progress.`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error indexing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // list_documentation - List all indexed documentation sources
    mcp.tool(
        'list_documentation',
        'List all indexed documentation sources',
        {},
        async () => {
            try {
                const documentation = await documentationIndexer.listDocumentation()

                if (documentation.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: '📚 No indexed documentation found.\n\nUse index_documentation to start indexing a documentation site.'
                        }],
                    }
                }

                const docList = documentation.map(doc =>
                    `• ${doc.name} (${doc.id})\n  URL: ${doc.url}\n  Status: ${doc.status} | Progress: ${doc.progress}% | Pages: ${doc.indexedPages}/${doc.totalPages}`
                ).join('\n\n')

                return {
                    content: [{
                        type: 'text',
                        text: `📚 Indexed Documentation (${documentation.length}):\n\n${docList}`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error listing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // check_documentation_status - Monitor documentation indexing
    mcp.tool(
        'check_documentation_status',
        'Check the indexing status of a documentation source',
        {
            source_id: z.string().describe('Documentation source ID'),
        },
        async ({ source_id }) => {
            try {
                const status = await documentationIndexer.checkDocumentationStatus(source_id)

                if (!status) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Documentation source "${source_id}" not found.\n\nUse list_documentation to see available documentation sources.`
                        }],
                    }
                }

                const statusText = `📊 Documentation Status: ${status.name}\n\n` +
                    `Source ID: ${status.id}\n` +
                    `URL: ${status.url}\n` +
                    `Status: ${status.status}\n` +
                    `Progress: ${status.progress}%\n` +
                    `Pages Indexed: ${status.indexedPages}/${status.totalPages}\n` +
                    `Last Indexed: ${status.lastIndexed.toLocaleString()}\n` +
                    (status.error ? `Error: ${status.error}` : '')

                return {
                    content: [{
                        type: 'text',
                        text: statusText
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error checking documentation status: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // delete_documentation - Remove indexed documentation
    mcp.tool(
        'delete_documentation',
        'Delete an indexed documentation source',
        {
            source_id: z.string().describe('Documentation source ID to delete'),
        },
        async ({ source_id }) => {
            try {
                const deleted = await documentationIndexer.deleteDocumentation(source_id)

                if (deleted) {
                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Documentation source "${source_id}" has been deleted from the index.`
                        }],
                    }
                } else {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Documentation source "${source_id}" not found in the index.`
                        }],
                    }
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error deleting documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // rename_documentation - Rename documentation sources
    mcp.tool(
        'rename_documentation',
        'Rename a documentation source for better organization',
        {
            source_id: z.string().describe('Documentation source ID'),
            new_name: z.string().min(1).max(100).describe('New display name (1-100 characters)'),
        },
        async ({ source_id, new_name }) => {
            try {
                const renamed = await documentationIndexer.renameDocumentation(source_id, new_name)

                if (renamed) {
                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Documentation source "${source_id}" has been renamed to "${new_name}".`
                        }],
                    }
                } else {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Documentation source "${source_id}" not found in the index.`
                        }],
                    }
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error renaming documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // search_documentation - Search indexed documentation using natural language
    mcp.tool(
        'search_documentation',
        'Search indexed documentation using natural language',
        {
            query: z.string().describe('Natural language search query (use comprehensive questions for best results)'),
            sources: z.array(z.string()).optional().describe('List of documentation source IDs to search'),
            include_sources: z.boolean().default(true).describe('Whether to include source references in results'),
        },
        async ({ query, sources, include_sources }) => {
            try {
                const results = await searchEngine.searchDocumentation(query, {
                    sources,
                    includeSources: include_sources,
                    maxResults: 10
                })

                if (results.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `🔍 No documentation results found for query: "${query}"\n\nTry:\n• Using more specific keywords\n• Checking if documentation is indexed\n• Using different search terms`
                        }],
                    }
                }

                const resultsText = results.map((result, index) =>
                    `${index + 1}. **${result.title}**\n` +
                    `   Score: ${(result.score * 100).toFixed(1)}%\n` +
                    `   ${result.content}\n` +
                    (result.url ? `   Source: ${result.url}\n` : '') +
                    `   Metadata: ${JSON.stringify(result.metadata)}\n`
                ).join('\n')

                return {
                    content: [{
                        type: 'text',
                        text: `🔍 Documentation Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )
} 
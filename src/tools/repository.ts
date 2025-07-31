import type { McpToolContext } from '../types'
import { z } from 'zod'
import { RepositoryIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'

// Создаем глобальные экземпляры
const repositoryIndexer = new RepositoryIndexer()
const searchEngine = new SearchEngine()

export function registerRepositoryTools({ mcp }: McpToolContext): void {
    // index_repository - Index GitHub repositories for intelligent search
    mcp.tool(
        'index_repository',
        'Index a GitHub repository for intelligent code search',
        {
            repo_url: z.string().describe('GitHub repository URL (e.g., https://github.com/owner/repo)'),
            branch: z.string().optional().describe('Branch to index (defaults to main branch)'),
        },
        async ({ repo_url, branch }) => {
            try {
                const result = await repositoryIndexer.indexRepository(repo_url, { branch })
                return {
                    content: [{
                        type: 'text',
                        text: `✅ Repository indexing started for ${result.id}\n\n` +
                            `Repository: ${result.owner}/${result.repo}\n` +
                            `Branch: ${result.branch}\n` +
                            `Status: ${result.status}\n` +
                            `Progress: ${result.progress}%\n` +
                            `Files Indexed: ${result.indexedFiles}/${result.totalFiles}\n\n` +
                            `Use check_repository_status("${result.id}") to monitor progress.`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error indexing repository: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                            `Please check:\n` +
                            `• URL format: https://github.com/owner/repo\n` +
                            `• Repository accessibility\n` +
                            `• Network connection`
                    }],
                }
            }
        },
    )

    // list_repositories - List all indexed repositories with status
    mcp.tool(
        'list_repositories',
        'List all indexed repositories with their status',
        {},
        async () => {
            try {
                const repositories = await repositoryIndexer.listRepositories()

                if (repositories.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: '📂 No indexed repositories found.\n\nUse index_repository to start indexing a GitHub repository.'
                        }],
                    }
                }

                const repoList = repositories.map(repo => {
                    let fileInfo = 'Files: Processing...'

                    if (repo.totalFiles > 0) {
                        const percentage = Math.round((repo.indexedFiles / repo.totalFiles) * 100)
                        fileInfo = `Files: ${repo.indexedFiles}/${repo.totalFiles} (${percentage}%)`

                        // Добавляем информацию о фильтрации, если доступна
                        if (repo.rawFiles && repo.excludedFiles) {
                            fileInfo += ` | Filtered: ${repo.excludedFiles} files excluded`
                        }
                    }

                    return `• ${repo.id} (${repo.branch})\n  Status: ${repo.status} | Progress: ${repo.progress}% | ${fileInfo}`
                }).join('\n\n')

                return {
                    content: [{
                        type: 'text',
                        text: `📂 Indexed Repositories (${repositories.length}):\n\n${repoList}`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error listing repositories: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // check_repository_status - Monitor indexing progress
    mcp.tool(
        'check_repository_status',
        'Check the indexing status of a repository',
        {
            repository: z.string().describe('Repository in owner/repo format'),
        },
        async ({ repository }) => {
            try {
                const status = await repositoryIndexer.checkRepositoryStatus(repository)

                if (!status) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Repository "${repository}" not found.\n\nUse list_repositories to see available repositories.`
                        }],
                    }
                }

                const statusText = `📊 Repository Status: ${repository}\n\n` +
                    `Status: ${status.status}\n` +
                    `Branch: ${status.branch}\n` +
                    `Progress: ${status.progress}%\n` +
                    `Files Indexed: ${status.indexedFiles}/${status.totalFiles}\n` +
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
                        text: `❌ Error checking repository status: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // delete_repository - Remove indexed repositories
    mcp.tool(
        'delete_repository',
        'Delete an indexed repository',
        {
            repository: z.string().describe('Repository in owner/repo format'),
        },
        async ({ repository }) => {
            try {
                const deleted = await repositoryIndexer.deleteRepository(repository)

                if (deleted) {
                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Repository "${repository}" has been deleted from the index.`
                        }],
                    }
                } else {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Repository "${repository}" not found in the index.`
                        }],
                    }
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error deleting repository: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // rename_repository - Rename repositories for better organization
    mcp.tool(
        'rename_repository',
        'Rename an indexed repository for better organization',
        {
            repository: z.string().describe('Repository in owner/repo format'),
            new_name: z.string().min(1).max(100).describe('New display name (1-100 characters)'),
        },
        async ({ repository, new_name }) => {
            try {
                const renamed = await repositoryIndexer.renameRepository(repository, new_name)

                if (renamed) {
                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Repository "${repository}" has been renamed to "${new_name}".`
                        }],
                    }
                } else {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Repository "${repository}" not found in the index.`
                        }],
                    }
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error renaming repository: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )

    // search_codebase - Search indexed repositories using natural language
    mcp.tool(
        'search_codebase',
        'Search indexed repositories using natural language',
        {
            query: z.string().describe('Natural language search query (use comprehensive questions for best results)'),
            repositories: z.array(z.string()).optional().describe('List of repositories to search (owner/repo format)'),
            include_sources: z.boolean().default(true).describe('Whether to include source code in results'),
        },
        async ({ query, repositories, include_sources }) => {
            try {
                const results = await searchEngine.searchCodebase(query, {
                    repositories,
                    includeSources: include_sources,
                    maxResults: 10
                })

                if (results.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `🔍 No results found for query: "${query}"\n\nTry:\n• Using more specific keywords\n• Checking if repositories are indexed\n• Using different search terms`
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
                        text: `🔍 Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}`
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error searching codebase: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )
} 
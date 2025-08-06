import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { RepositoryIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'
import { safeLog } from '../utils'

// Global instances
let repositoryIndexer: RepositoryIndexer | null = null
let searchEngine: SearchEngine | null = null

// Initialize components
async function initializeComponents() {
  try {
    repositoryIndexer = new RepositoryIndexer()
    searchEngine = new SearchEngine()

    await Promise.all([
      repositoryIndexer.initialize(),
      searchEngine.initialize(),
    ])

    safeLog('✅ Repository plugin components initialized')
  } catch (error) {
    safeLog(`❌ Failed to initialize repository plugin components: ${error}`, 'error')
  }
}

// Start initialization
initializeComponents()

export function registerRepositoryPlugin(mcp: McpServer): void {
  mcp.tool(
    'repository_tools',
    'Repository management with 6 functions: index, list, check, delete, rename, search',
    {
      action: z.enum(['index', 'list', 'check', 'delete', 'rename', 'search']).describe('Action to perform'),
      repo_url: z.string().optional().describe('GitHub repository URL (required for index action)'),
      branch: z.string().optional().describe('Branch to index (defaults to main branch)'),
      repository: z.string().optional().describe('Repository in owner/repo format'),
      new_name: z.string().optional().describe('New display name for rename action'),
      query: z.string().optional().describe('Search query for search action'),
      repositories: z.array(z.string()).optional().describe('List of repositories to search'),
      include_sources: z.boolean().optional().default(true).describe('Include source code in search results'),
    },
    async ({ action, repo_url, branch, repository, new_name, query, repositories, include_sources }) => {
      try {
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        switch (action) {
          case 'index':
            return await handleIndexRepository(repo_url, branch)
          
          case 'list':
            return await handleListRepositories()
          
          case 'check':
            return await handleCheckRepositoryStatus(repository)
          
          case 'delete':
            return await handleDeleteRepository(repository)
          
          case 'rename':
            return await handleRenameRepository(repository, new_name)
          
          case 'search':
            return await handleSearchCodebase(query, repositories, include_sources)
          
          default:
            return {
              content: [{
                type: 'text' as const,
                text: `❌ Invalid action: ${action}\n\nAvailable actions: index, list, check, delete, rename, search`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Repository tools error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function handleIndexRepository(repo_url?: string, branch?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a repository URL.\n\nExample: repository_tools(action="index", repo_url="https://github.com/NURJAKS/Todo-list")`,
      }],
    }
  }

  try {
    const result = await repositoryIndexer!.indexRepository(repo_url, { branch })
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Successfully indexed repository: ${repo_url}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to index repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleListRepositories() {
  try {
    const repositories = await repositoryIndexer!.listRepositories()
    return {
      content: [{
        type: 'text' as const,
        text: `📋 Found ${repositories.length} repositories:\n${repositories.map(repo => `- ${repo.owner}/${repo.repo}`).join('\n')}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to list repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleCheckRepositoryStatus(repository?: string) {
  if (!repository) {
    return {
      content: [{
        type: 'text' as const,
        text: '❌ Repository name is required for status check',
      }],
    }
  }

  try {
    const status = await repositoryIndexer!.checkRepositoryStatus(repository)
    return {
      content: [{
        type: 'text' as const,
        text: `📊 Repository status for ${repository}: ${status?.status || 'unknown'}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to check repository status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleDeleteRepository(repository?: string) {
  if (!repository) {
    return {
      content: [{
        type: 'text' as const,
        text: '❌ Repository name is required for deletion',
      }],
    }
  }

  try {
    await repositoryIndexer!.deleteRepository(repository)
    return {
      content: [{
        type: 'text' as const,
        text: `🗑️ Successfully deleted repository: ${repository}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to delete repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleRenameRepository(repository?: string, new_name?: string) {
  if (!repository || !new_name) {
    return {
      content: [{
        type: 'text' as const,
        text: '❌ Repository name and new name are required for renaming',
      }],
    }
  }

  try {
    await repositoryIndexer!.renameRepository(repository, new_name)
    return {
      content: [{
        type: 'text' as const,
        text: `✏️ Successfully renamed repository from ${repository} to ${new_name}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to rename repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleSearchCodebase(query?: string, repositories?: string[], include_sources?: boolean) {
  if (!query) {
    return {
      content: [{
        type: 'text' as const,
        text: '❌ Search query is required',
      }],
    }
  }

  try {
    const results = await searchEngine!.searchCodebase(query, { repositories, includeSources: include_sources })
    return {
      content: [{
        type: 'text' as const,
        text: `🔍 Search results for "${query}":\n${results.map(result => `- ${result.title}: ${result.content.substring(0, 100)}...`).join('\n')}`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to search codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
} 
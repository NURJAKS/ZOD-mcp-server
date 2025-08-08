import type { McpToolContext } from '../types'
import { z } from 'zod'
import { RepositoryIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'
import { safeLog } from '../utils'
import { Octokit } from '@octokit/rest'

// Создаем глобальные экземпляры
let repositoryIndexer: RepositoryIndexer | null = null
let searchEngine: SearchEngine | null = null
let octokit: Octokit | null = null

// Инициализируем компоненты асинхронно
async function initializeComponents() {
  try {
    const token = process.env.GITHUB_TOKEN
    if (token) {
      octokit = new Octokit({ auth: token })
    } else {
      safeLog('⚠️ GITHUB_TOKEN not configured, repository analysis features will be limited', 'warn')
    }

    repositoryIndexer = new RepositoryIndexer()
    searchEngine = new SearchEngine()

    await Promise.all([
      repositoryIndexer.initialize(),
      searchEngine.initialize(),
    ])

    safeLog('✅ Components initialized successfully')
  } catch (error) {
    safeLog(`❌ Failed to initialize components: ${error}`, 'error')
  }
}

// Запускаем инициализацию
initializeComponents()

export function registerRepositoryTools({ mcp }: McpToolContext): void {
  // Single Unified Repository Tools Plugin
  // This single tool handles all repository management operations

  mcp.tool(
    'repository_tools',
    'Unified repository management tool with 6 functions: index, list, check status, delete, rename, and search repositories',
    {
      action: z.enum(['index', 'list', 'check_status', 'delete', 'rename', 'search']).describe('Action to perform'),
      repo_url: z.string().optional().describe('GitHub repository URL (required for index action)'),
      branch: z.string().optional().describe('Branch to index (defaults to main branch, used with index action)'),
      repository: z.string().optional().describe('Repository in owner/repo format (used with check_status, delete, rename actions)'),
      new_name: z.string().optional().describe('New display name for rename action (1-100 characters)'),
      query: z.string().optional().describe('Search query for search action'),
      repositories: z.array(z.string()).optional().describe('List of repositories to search (owner/repo format, used with search action)'),
      include_sources: z.boolean().optional().default(true).describe('Whether to include source code in search results'),
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
          
          case 'check_status':
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
                text: `❌ Invalid action: ${action}\n\nAvailable actions: index, list, check_status, delete, rename, search`,
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

// Helper functions for each action
async function handleIndexRepository(repo_url?: string, branch?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a repository URL.\n\nExample: repository_tools(action="index", repo_url="https://github.com/NURJAKS/Todo-list")`,
      }],
    }
  }

  if (!repo_url.includes('github.com/')) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Invalid GitHub URL format.\n\nPlease use: https://github.com/owner/repo\nExample: https://github.com/NURJAKS/Todo-list`,
      }],
    }
  }

  const { owner, repo } = repositoryIndexer!.parseGitHubUrl(repo_url)
  const existingStatus = await repositoryIndexer!.checkRepositoryStatus(`${owner}/${repo}`)
  
  if (existingStatus) {
    if (existingStatus.status === 'indexing') {
      return {
        content: [{
          type: 'text' as const,
          text: `🔄 Repository "${owner}/${repo}" is already being indexed.\n\n`
            + `Status: ${existingStatus.status}\n`
            + `Progress: ${existingStatus.progress}%\n`
            + `Files Indexed: ${existingStatus.indexedFiles}/${existingStatus.totalFiles}\n`
            + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}`,
        }],
      }
    }
    
    if (existingStatus.status === 'completed') {
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Repository "${owner}/${repo}" is already indexed.\n\n`
            + `Status: ${existingStatus.status}\n`
            + `Branch: ${existingStatus.branch}\n`
            + `Files Indexed: ${existingStatus.indexedFiles}\n`
            + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}\n\n`
            + `💡 Ready to search! Use: repository_tools(action="search", query="your query")`,
        }],
      }
    }
  }

  // Start indexing
  const result = await repositoryIndexer!.indexRepository(repo_url, {
    branch: branch || 'main',
  })

  return {
    content: [{
      type: 'text' as const,
      text: `🚀 Repository Index Started\n\n`
        + `**Repository**: \`${result.id}\`\n`
        + `**Status**: 🔄 Indexing started\n`
        + `**Branch**: ${result.branch}\n`
        + `**URL**: https://github.com/${result.owner}/${result.repo}\n\n`
        + `**Next Steps:**\n`
        + `- Use \`repository_tools(action="check_status", repository="${owner}/${repo}")\` to monitor indexing progress\n`
        + `- Once complete, you'll be able to search and analyze the codebase`,
    }],
  }
}

async function handleListRepositories() {
  const repositories = await repositoryIndexer!.listRepositories()

  if (repositories.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `📚 No indexed repositories found.\n\nUse repository_tools(action="index", repo_url="https://github.com/owner/repo") to start indexing a repository.`,
      }],
    }
  }

  const repoList = repositories.map(repo => {
    const statusIcon = repo.status === 'completed' ? '✅' : repo.status === 'indexing' ? '🔄' : '❌'
    const progressText = repo.status === 'indexing' ? ` | Progress: ${repo.progress}%` : ''
    const filesText = repo.status === 'completed' ? ` | Files: ${repo.indexedFiles}` : ` | Files: ${repo.indexedFiles}/${repo.totalFiles}`
    
    return `${statusIcon} **${repo.displayName || repo.id}**\n`
      + `   Branch: ${repo.branch}\n`
      + `   Status: ${repo.status}${progressText}${filesText}\n`
      + `   Last Indexed: ${repo.lastIndexed.toLocaleString()}`
  }).join('\n\n')

  return {
    content: [{
      type: 'text' as const,
      text: `📚 **Indexed Repositories** (${repositories.length})\n\n${repoList}\n\n💡 Use repository_tools(action="check_status", repository="owner/repo") to get detailed status.`,
    }],
  }
}

async function handleCheckRepositoryStatus(repository?: string) {
  if (!repository?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a repository name.\n\nExample: repository_tools(action="check_status", repository="NURJAKS/Todo-list")`,
      }],
    }
  }

  const status = await repositoryIndexer!.checkRepositoryStatus(repository)

  if (!status) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Repository "${repository}" not found.\n\nUse repository_tools(action="list") to see available repositories.`,
      }],
    }
  }

  // If indexing is completed and there's a detailed report
  if (status.status === 'completed' && status.report) {
    const report = JSON.parse(status.report)
    const languages = Object.entries(report.summary.languages)
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ')

    return {
      content: [{
        type: 'text' as const,
        text: `✅ Repository Status: ${status.displayName || status.id}\n\n`
          + `📊 Summary:\n`
          + `• Status: ${status.status}\n`
          + `• Branch: ${status.branch}\n`
          + `• Total scanned: ${report.summary.totalScanned} files\n`
          + `• Indexed: ${report.summary.totalIndexed} files (${Math.round((report.summary.totalIndexed / report.summary.totalScanned) * 100)}%)\n`
          + `• Excluded: ${report.summary.totalExcluded} files (${Math.round((report.summary.totalExcluded / report.summary.totalScanned) * 100)}%)\n`
          + `• Languages: ${languages}\n`
          + `• Size indexed: ${Math.round(report.summary.sizeIndexed / 1024)} KB\n`
          + `• Last indexed: ${status.lastIndexed.toLocaleString()}\n\n`
          + `💡 Ready to search! Use: repository_tools(action="search", query="your query")`,
      }],
    }
  }

  // If indexing is in progress
  const statusText = `🔄 Repository Status: ${status.displayName || status.id}\n\n`
    + `Status: ${status.status}\n`
    + `Branch: ${status.branch}\n`
    + `Progress: ${status.progress}%\n`
    + `Files Indexed: ${status.indexedFiles}/${status.totalFiles}\n`
    + `Last Indexed: ${status.lastIndexed.toLocaleString()}\n${status.error ? `Error: ${status.error}` : ''}`

  return {
    content: [{
      type: 'text' as const,
      text: statusText,
    }],
  }
}

async function handleDeleteRepository(repository?: string) {
  if (!repository?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a repository name.\n\nExample: repository_tools(action="delete", repository="NURJAKS/Todo-list")`,
      }],
    }
  }

  const deleted = await repositoryIndexer!.deleteRepository(repository)

  if (deleted) {
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Repository "${repository}" has been deleted from the index.`,
      }],
    }
  } else {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Repository "${repository}" not found or could not be deleted.`,
      }],
    }
  }
}

async function handleRenameRepository(repository?: string, new_name?: string) {
  if (!repository?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a repository name.\n\nExample: repository_tools(action="rename", repository="NURJAKS/Todo-list", new_name="My Todo App")`,
      }],
    }
  }

  if (!new_name?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a new name.\n\nExample: repository_tools(action="rename", repository="NURJAKS/Todo-list", new_name="My Todo App")`,
      }],
    }
  }

  const renamed = await repositoryIndexer!.renameRepository(repository, new_name)

  if (renamed) {
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Repository "${repository}" has been renamed to "${new_name}".`,
      }],
    }
  } else {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Repository "${repository}" not found or could not be renamed.`,
      }],
    }
  }
}

async function handleSearchCodebase(query?: string, repositories?: string[], include_sources?: boolean) {
  if (!searchEngine) {
    throw new Error('Search engine not initialized')
  }

  if (!query?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a search query.\n\nExample: repository_tools(action="search", query="function login authentication")`,
      }],
    }
  }

  const results = await searchEngine.searchCodebase(query, {
    repositories: repositories,
    includeSources: include_sources,
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `🔍 No search results found for query: "${query}"\n\nTry:\n• Using different keywords\n• Using broader search terms\n• Checking if repositories are indexed with repository_tools(action="list")`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Score: ${(result.score * 100).toFixed(1)}%\n`
    + `   ${result.content}\n${
      result.url ? `   URL: ${result.url}\n` : ''
    }   Repository: ${result.metadata.repository || 'Unknown'}`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text' as const,
      text: `🔍 Code Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n💡 Use repository_tools(action="check_status", repository="owner/repo") to see indexing status.`,
    }],
  }
}

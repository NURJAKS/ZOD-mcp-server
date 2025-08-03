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
  // Unified repository tool that handles all repository operations
  mcp.tool(
    'repository',
    'Manage GitHub repositories for intelligent code search and analysis',
    {
      action: z.enum(['index', 'list', 'check_status', 'delete', 'rename', 'search']).describe('Repository action to perform'),
      repo_url: z.string().optional().describe('GitHub repository URL (e.g., https://github.com/owner/repo)'),
      branch: z.string().optional().describe('Branch to index (defaults to main branch)'),
      new_name: z.string().optional().describe('New name for repository (for rename action)'),
      query: z.string().optional().describe('Search query (for search action)'),
      repositories: z.array(z.string()).optional().describe('List of repositories (for list action)'),
    },
    async ({ action, repo_url, branch, new_name, query, repositories }) => {
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
            return await handleCheckRepositoryStatus(repo_url)
          case 'delete':
            return await handleDeleteRepository(repo_url)
          case 'rename':
            return await handleRenameRepository(repo_url, new_name)
          case 'search':
            return await handleSearchCodebase(query)
          default:
            return {
              content: [{
                type: 'text',
                text: `❌ Invalid action. Available actions: index, list, check_status, delete, rename, search\n\n`
                  + `📋 **Repository Management Tool**\n\n`
                  + `**Available Actions:**\n`
                  + `• \`index\` - Index a GitHub repository for search\n`
                  + `• \`list\` - List all indexed repositories\n`
                  + `• \`check_status\` - Check indexing status of a repository\n`
                  + `• \`delete\` - Delete an indexed repository\n`
                  + `• \`rename\` - Rename an indexed repository\n`
                  + `• \`search\` - Search code in indexed repositories\n\n`
                  + `**Examples:**\n`
                  + `• \`repository("index", "https://github.com/owner/repo")\`\n`
                  + `• \`repository("list")\`\n`
                  + `• \`repository("search", query="function login")\``,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Repository operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

// Internal handlers for each repository operation
async function handleIndexRepository(repo_url?: string, branch?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a repository URL.\n\nExample: repository("index", "https://github.com/NURJAKS/Todo-list")`,
      }],
    }
  }

  if (!repo_url.includes('github.com/')) {
    return {
      content: [{
        type: 'text',
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
          type: 'text',
          text: `🔄 Repository "${owner}/${repo}" is already being indexed.\n\n`
            + `Status: ${existingStatus.status}\n`
            + `Progress: ${existingStatus.progress}%\n`
            + `Files Indexed: ${existingStatus.indexedFiles}/${existingStatus.totalFiles}\n`
            + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}`,
        }],
      }
    } else if (existingStatus.status === 'completed') {
      return {
        content: [{
          type: 'text',
          text: `✅ Repository "${owner}/${repo}" is already indexed and ready to use!\n\n`
            + `Status: ${existingStatus.status}\n`
            + `Files Indexed: ${existingStatus.indexedFiles}/${existingStatus.totalFiles}\n`
            + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}\n\n`
            + `💡 You can now search the repository using:\n`
            + `repository("search", query="your search terms")`,
        }],
      }
    }
  }

  try {
    const result = await repositoryIndexer!.indexRepository(repo_url, { branch })
    return {
      content: [{
        type: 'text',
        text: `🚀 Started indexing repository "${owner}/${repo}"\n\n`
          + `Repository: ${repo_url}\n`
          + `Branch: ${branch || 'main'}\n`
          + `Status: Indexing started\n\n`
          + `💡 Use repository("check_status", "${owner}/${repo}") to monitor progress.`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to start indexing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }


async function handleListRepositories() {
  try {
    if (!repositoryIndexer) {
      throw new Error('Repository indexer not initialized')
    }
    const repositories = await repositoryIndexer.listRepositories()

    if (repositories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '📂 No indexed repositories found.\n\nUse repository("index", "https://github.com/owner/repo") to start indexing a GitHub repository.',
        }],
      }
    }

    const repoList = repositories.map((repo) => {
      let fileInfo = 'Files: Processing...'
      let statusIcon = '🔄'

      // Set status icon
      if (repo.status === 'completed') {
        statusIcon = '✅'
      } else if (repo.status === 'failed') {
        statusIcon = '❌'
      }

      if (repo.totalFiles > 0) {
        const percentage = Math.round((repo.indexedFiles / repo.totalFiles) * 100)
        fileInfo = `Files: ${repo.indexedFiles}/${repo.totalFiles} (${percentage}%)`

        // Add filtering information if available
        if (repo.rawFiles && repo.excludedFiles) {
          fileInfo += ` | Excluded: ${repo.excludedFiles} files`
        }
      }

      const displayName = repo.displayName || repo.id
      const lastIndexed = repo.lastIndexed.toLocaleString()
      
      return `${statusIcon} **${displayName}** (${repo.branch})\n`
        + `   Status: ${repo.status} | Progress: ${repo.progress}%\n`
        + `   ${fileInfo}\n`
        + `   Last indexed: ${lastIndexed}`
    }).join('\n\n')

    return {
      content: [{
        type: 'text',
        text: `📂 Indexed Repositories (${repositories.length}):\n\n${repoList}`,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error listing repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleCheckRepositoryStatus(repo_url?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a repository URL.\n\nExample: repository("check_status", "https://github.com/owner/repo")`,
      }],
    }
  }

  try {
    const { owner, repo } = repositoryIndexer!.parseGitHubUrl(repo_url)
    const status = await repositoryIndexer!.checkRepositoryStatus(`${owner}/${repo}`)

    if (!status) {
      return {
        content: [{
          type: 'text',
          text: `❌ Repository "${owner}/${repo}" not found.\n\nUse repository("list") to see available repositories.`,
        }],
      }
    }

    // Если индексация завершена и есть детальный отчет
    if (status.status === 'completed' && status.report) {
      const report = JSON.parse(status.report)
      const languages = Object.entries(report.summary.languages)
        .map(([lang, count]) => `${lang} (${count})`)
        .join(', ')

      return {
        content: [{
          type: 'text',
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
            + `💡 Ready to search! Use: repository("search", query="your query")`,
        }],
      }
    }

    // Если индексация в процессе
    const statusText = `🔄 Repository Status: ${status.displayName || status.id}\n\n`
      + `Status: ${status.status}\n`
      + `Branch: ${status.branch}\n`
      + `Progress: ${status.progress}%\n`
      + `Files Indexed: ${status.indexedFiles}/${status.totalFiles}\n`
      + `Last Indexed: ${status.lastIndexed.toLocaleString()}\n${status.error ? `Error: ${status.error}` : ''}`

    return {
      content: [{
        type: 'text',
        text: statusText,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error checking repository status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleDeleteRepository(repo_url?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a repository URL.\n\nExample: repository("delete", "https://github.com/owner/repo")`,
      }],
    }
  }

  try {
    const { owner, repo } = repositoryIndexer!.parseGitHubUrl(repo_url)
    const deleted = await repositoryIndexer!.deleteRepository(`${owner}/${repo}`)

    if (deleted) {
      return {
        content: [{
          type: 'text',
          text: `✅ Repository "${owner}/${repo}" has been deleted from the index.`,
        }],
      }
    }
    else {
      return {
        content: [{
          type: 'text',
          text: `❌ Repository "${owner}/${repo}" not found in the index.`,
        }],
      }
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error deleting repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleRenameRepository(repo_url?: string, new_name?: string) {
  if (!repo_url?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a repository URL.\n\nExample: repository("rename", "https://github.com/owner/repo", "new-name")`,
      }],
    }
  }

  if (!new_name?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a new name.\n\nExample: repository("rename", "https://github.com/owner/repo", "new-name")`,
      }],
    }
  }

  try {
    const { owner, repo } = repositoryIndexer!.parseGitHubUrl(repo_url)
    const renamed = await repositoryIndexer!.renameRepository(`${owner}/${repo}`, new_name)

    if (renamed) {
      return {
        content: [{
          type: 'text',
          text: `✅ Repository "${owner}/${repo}" has been renamed to "${new_name}".`,
        }],
      }
    }
    else {
      return {
        content: [{
          type: 'text',
          text: `❌ Repository "${owner}/${repo}" not found in the index.`,
        }],
      }
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error renaming repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleSearchCodebase(query?: string) {
  if (!query?.trim()) {
    return {
      content: [{
        type: 'text',
        text: `❌ Please provide a search query.\n\nExample: repository("search", query="authentication function")`,
      }],
    }
  }

  try {
    if (!searchEngine) {
      throw new Error('Search engine not initialized')
    }

    const results = await searchEngine.searchCodebase(query, {
      includeSources: true,
      maxResults: 10,
    })

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No results found for query: "${query}"\n\n💡 Suggestions:\n• Use more specific keywords (e.g., "React component" instead of "code")\n• Check if repositories are indexed: repository("list")\n• Try different search terms\n• Make sure repositories are fully indexed`,
        }],
      }
    }

    const resultsText = results.map((result, index) => {
      const score = (result.score * 100).toFixed(1)
      const content = result.content.length > 300 
        ? result.content.substring(0, 300) + '...' 
        : result.content
      
      let sourceInfo = ''
      if (result.metadata?.repository) {
        sourceInfo += `Repository: ${result.metadata.repository}\n`
      }
      if (result.metadata?.path) {
        sourceInfo += `File: ${result.metadata.path}\n`
      }
      if (result.metadata?.language) {
        sourceInfo += `Language: ${result.metadata.language}\n`
      }

      return `${index + 1}. **${result.title || 'Code Snippet'}**\n`
        + `   Score: ${score}%\n`
        + `   ${sourceInfo}`
        + `   Content: ${content}\n`
    }).join('\n')

    return {
      content: [{
        type: 'text',
        text: `🔍 Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}\n\n💡 Tip: Use more specific queries for better results!`,
      }],
    }
  }
  catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error searching codebase: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• If repositories are indexed\n• Network connection\n• Search query format`,
      }],
    }
  }
}


}

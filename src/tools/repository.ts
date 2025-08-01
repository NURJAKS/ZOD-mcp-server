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
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        // Validate repository URL
        if (!repo_url.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a repository URL.\n\nExample: index_repository("https://github.com/NURJAKS/Todo-list")`,
            }],
          }
        }

        // Validate GitHub URL format
        if (!repo_url.includes('github.com/')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid GitHub URL format.\n\nPlease use: https://github.com/owner/repo\nExample: https://github.com/NURJAKS/Todo-list`,
            }],
          }
        }

        // Check if repository already exists
        const { owner, repo } = repositoryIndexer.parseGitHubUrl(repo_url)
        const existingStatus = await repositoryIndexer.checkRepositoryStatus(`${owner}/${repo}`)
        
        if (existingStatus) {
          if (existingStatus.status === 'indexing') {
            return {
              content: [{
                type: 'text',
                text: `🔄 Repository "${owner}/${repo}" is already being indexed.\n\n`
                  + `Status: ${existingStatus.status}\n`
                  + `Progress: ${existingStatus.progress}%\n`
                  + `Files Indexed: ${existingStatus.indexedFiles}/${existingStatus.totalFiles}\n`
                  + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}\n\n`
                  + `Use check_repository_status("${owner}/${repo}") to monitor progress.`,
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
                  + `   search_codebase("your query")\n\n`
                  + `📊 Repository details:\n`
                  + `   • Branch: ${existingStatus.branch}\n`
                  + `   • Progress: ${existingStatus.progress}%\n`
                  + `   • Ready for search: ✅`,
              }],
            }
          } else if (existingStatus.status === 'failed') {
            return {
              content: [{
                type: 'text',
                text: `❌ Repository "${owner}/${repo}" previously failed to index.\n\n`
                  + `Error: ${existingStatus.error || 'Unknown error'}\n`
                  + `Last Indexed: ${existingStatus.lastIndexed.toLocaleString()}\n\n`
                  + `The system will retry indexing automatically.`,
              }],
            }
          }
        }

        const result = await repositoryIndexer.indexRepository(repo_url, { branch })

        // Если индексация завершена, показываем детальный отчет
        if (result.status === 'completed' && result.report) {
          const report = JSON.parse(result.report)
          const languages = Object.entries(report.summary.languages)
            .map(([lang, count]) => `${lang} (${count})`)
            .join(', ')

          return {
            content: [{
              type: 'text',
              text: `✅ Indexing completed: ${result.id}\n\n` +
                `📁 Indexed Files (${report.summary.totalIndexed}):\n` +
                `├── ${report.indexedFiles.slice(0, 5).map((f: any) => f.path).join('\n├── ')}\n` +
                (report.indexedFiles.length > 5 ? `├── ... and ${report.indexedFiles.length - 5} more files\n` : '') +
                `\n🗑️ Excluded Files (${report.summary.totalExcluded}):\n` +
                `├── ${report.excludedFiles.slice(0, 5).map((f: any) => `${f.path} - ${f.reason}`).join('\n├── ')}\n` +
                (report.excludedFiles.length > 5 ? `├── ... and ${report.excludedFiles.length - 5} more files\n` : '') +
                `\n📈 Summary:\n` +
                `• Total scanned: ${report.summary.totalScanned} files\n` +
                `• Indexed: ${report.summary.totalIndexed} files (${Math.round((report.summary.totalIndexed / report.summary.totalScanned) * 100)}%)\n` +
                `• Excluded: ${report.summary.totalExcluded} files (${Math.round((report.summary.totalExcluded / report.summary.totalScanned) * 100)}%)\n` +
                `• Languages: ${languages}\n` +
                `• Size indexed: ${Math.round(report.summary.sizeIndexed / 1024)} KB\n` +
                `• Average file size: ${Math.round(report.summary.averageFileSize)} bytes\n\n` +
                `💡 Ready to search! Use: search_codebase("your query")`,
            }],
          }
        }

        // Если индексация еще в процессе
        return {
          content: [{
            type: 'text',
            text: `🔄 Indexing started: ${result.id}\n\n`
              + `Repository: ${result.owner}/${result.repo}\n`
              + `Branch: ${result.branch}\n`
              + `Status: ${result.status}\n`
              + `Progress: ${result.progress}%\n`
              + `Files Indexed: ${result.indexedFiles}/${result.totalFiles}\n\n`
              + `Use check_repository_status("${result.id}") to monitor progress.`,
          }],
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Check if it's a "not found" error
        if (errorMessage.includes('not found') || errorMessage.includes('not accessible')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Repository not accessible: ${errorMessage}\n\n`
                + `🔍 Possible reasons:\n`
                + `• Repository is private and requires authentication\n`
                + `• Repository doesn't exist or has been renamed\n`
                + `• Network connectivity issues\n`
                + `• GitHub API rate limiting\n\n`
                + `💡 Solutions:\n`
                + `• Verify the repository URL is correct\n`
                + `• Check if the repository is public\n`
                + `• Ensure your GitHub token has proper permissions\n`
                + `• Try again in a few minutes if rate limited`,
            }],
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: `❌ Error indexing repository: ${errorMessage}\n\n`
              + `Please check:\n`
              + `• URL format: https://github.com/owner/repo\n`
              + `• Repository accessibility\n`
              + `• GitHub token configuration\n`
              + `• Network connection`,
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
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }
        const repositories = await repositoryIndexer.listRepositories()

        if (repositories.length === 0) {
          return {
            content: [{
              type: 'text',
              text: '📂 No indexed repositories found.\n\nUse index_repository to start indexing a GitHub repository.',
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
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        // Validate repository format
        if (!repository.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a repository name.\n\nExample: check_repository_status("NURJAKS/Todo-list")`,
            }],
          }
        }

        // Validate repository format (owner/repo)
        if (!repository.includes('/')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid repository format.\n\nPlease use: owner/repo\nExample: check_repository_status("NURJAKS/Todo-list")`,
            }],
          }
        }

        const status = await repositoryIndexer.checkRepositoryStatus(repository)

        if (!status) {
          return {
            content: [{
              type: 'text',
              text: `❌ Repository "${repository}" not found.\n\nUse list_repositories to see available repositories.`,
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
                + `💡 Ready to search! Use: search_codebase("your query")`,
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
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        // Validate repository format
        if (!repository.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a repository name.\n\nExample: delete_repository("NURJAKS/Todo-list")`,
            }],
          }
        }

        // Validate repository format (owner/repo)
        if (!repository.includes('/')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid repository format.\n\nPlease use: owner/repo\nExample: delete_repository("NURJAKS/Todo-list")`,
            }],
          }
        }

        const deleted = await repositoryIndexer.deleteRepository(repository)

        if (deleted) {
          return {
            content: [{
              type: 'text',
              text: `✅ Repository "${repository}" has been deleted from the index.`,
            }],
          }
        }
        else {
          return {
            content: [{
              type: 'text',
              text: `❌ Repository "${repository}" not found in the index.`,
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
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        // Validate repository format
        if (!repository.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a repository name.\n\nExample: rename_repository("NURJAKS/Todo-list", "My Todo App")`,
            }],
          }
        }

        // Validate repository format (owner/repo)
        if (!repository.includes('/')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid repository format.\n\nPlease use: owner/repo\nExample: rename_repository("NURJAKS/Todo-list", "My Todo App")`,
            }],
          }
        }

        // Validate new name
        if (!new_name.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a new name.\n\nExample: rename_repository("NURJAKS/Todo-list", "My Todo App")`,
            }],
          }
        }

        const renamed = await repositoryIndexer.renameRepository(repository, new_name)

        if (renamed) {
          return {
            content: [{
              type: 'text',
              text: `✅ Repository "${repository}" has been renamed to "${new_name}".`,
            }],
          }
        }
        else {
          return {
            content: [{
              type: 'text',
              text: `❌ Repository "${repository}" not found in the index.`,
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
        if (!searchEngine) {
          throw new Error('Search engine not initialized')
        }

        // Validate query
        if (!query.trim()) {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a search query.\n\nExample: search_codebase("authentication function")`,
            }],
          }
        }

        const results = await searchEngine.searchCodebase(query, {
          repositories,
          includeSources: include_sources,
          maxResults: 10,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `🔍 No results found for query: "${query}"\n\n💡 Suggestions:\n• Use more specific keywords (e.g., "React component" instead of "code")\n• Check if repositories are indexed: list_repositories()\n• Try different search terms\n• Make sure repositories are fully indexed`,
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
    },
  )

  // Advanced repository analysis tool
  mcp.tool(
    'analyze_repository',
    'Perform comprehensive analysis of a GitHub repository including code quality, dependencies, and metrics',
    {
      repository: z.string().describe('Repository in owner/repo format'),
      analysis_type: z.enum(['full', 'dependencies', 'quality', 'activity', 'security']).default('full').describe('Type of analysis to perform'),
    },
    async ({ repository, analysis_type }) => {
      try {
        if (!repository || !repository.includes('/')) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid repository format. Use "owner/repo" format (e.g., "NURJAKS/MCP-server")`,
            }],
          }
        }

        if (!octokit) {
          return {
            content: [{
              type: 'text',
              text: `❌ GitHub API not available. Please configure GITHUB_TOKEN environment variable to use repository analysis features.`,
            }],
          }
        }

        const [owner, repo] = repository.split('/')
        
        // Get repository information
        const repoInfo = await octokit.repos.get({ owner, repo })
        
        // Get languages
        const languages = await octokit.repos.listLanguages({ owner, repo })
        
        // Get contributors
        const contributors = await octokit.repos.listContributors({ owner, repo, per_page: 10 })
        
        // Get recent commits
        const commits = await octokit.repos.listCommits({ owner, repo, per_page: 10 })
        
        // Get dependency files
        const dependencyFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle']
        const dependencyAnalysis: Array<{file: string, content: string}> = []
        
        for (const file of dependencyFiles) {
          try {
            const content = await octokit.repos.getContent({ owner, repo, path: file })
            if (content.data && !Array.isArray(content.data) && 'content' in content.data) {
              const decoded = Buffer.from(content.data.content, 'base64').toString()
              dependencyAnalysis.push({ file, content: decoded })
            }
          } catch (error) {
            // File doesn't exist, continue
          }
        }

        // Calculate metrics
        const totalSize = Object.values(languages.data).reduce((sum: number, bytes: any) => sum + bytes, 0)
        const languagePercentages = Object.entries(languages.data).map(([lang, bytes]) => ({
          language: lang,
          percentage: ((bytes as number) / totalSize * 100).toFixed(1)
        }))

        const analysis = {
          repository: repository,
          name: repoInfo.data.name,
          description: repoInfo.data.description || 'No description',
          stars: repoInfo.data.stargazers_count,
          forks: repoInfo.data.forks_count,
          watchers: repoInfo.data.watchers_count,
          open_issues: repoInfo.data.open_issues_count,
          created_at: repoInfo.data.created_at,
          updated_at: repoInfo.data.updated_at,
          language: repoInfo.data.language,
          size: repoInfo.data.size,
          license: repoInfo.data.license?.name || 'No license',
          topics: repoInfo.data.topics || [],
          languages: languagePercentages,
          contributors_count: contributors.data.length,
          recent_commits: commits.data.length,
          dependencies: dependencyAnalysis,
          analysis_type
        }

        let report = `🔍 **Repository Analysis: ${repository}**\n\n`
        
        if (analysis_type === 'full' || analysis_type === 'activity') {
          report += `📊 **Activity Metrics:**\n`
          report += `• Stars: ⭐ ${analysis.stars}\n`
          report += `• Forks: 🔀 ${analysis.forks}\n`
          report += `• Watchers: 👀 ${analysis.watchers}\n`
          report += `• Open Issues: 🐛 ${analysis.open_issues}\n`
          report += `• Contributors: 👥 ${analysis.contributors_count}\n`
          report += `• Recent Commits: 📝 ${analysis.recent_commits}\n\n`
        }

        if (analysis_type === 'full' || analysis_type === 'quality') {
          report += `📈 **Code Quality:**\n`
          report += `• Primary Language: ${analysis.language || 'Unknown'}\n`
          report += `• Repository Size: ${analysis.size} KB\n`
          report += `• License: ${analysis.license}\n`
          report += `• Created: ${new Date(analysis.created_at).toLocaleDateString()}\n`
          report += `• Last Updated: ${new Date(analysis.updated_at).toLocaleDateString()}\n\n`
        }

        if (analysis_type === 'full' || analysis_type === 'dependencies') {
          report += `📦 **Dependencies:**\n`
          if (analysis.dependencies.length > 0) {
            analysis.dependencies.forEach(dep => {
              report += `• ${dep.file}: Found\n`
            })
          } else {
            report += `• No common dependency files found\n`
          }
          report += `\n`
        }

        if (analysis_type === 'full') {
          report += `🌐 **Language Distribution:**\n`
          analysis.languages.slice(0, 5).forEach(lang => {
            report += `• ${lang.language}: ${lang.percentage}%\n`
          })
          report += `\n`
        }

        if (analysis.topics.length > 0) {
          report += `🏷️ **Topics:** ${analysis.topics.join(', ')}\n\n`
        }

        report += `**Next Steps:**\n`
        report += `• Use index_repository to add this repo to your search index\n`
        report += `• Use search_codebase to search the codebase\n`
        report += `• Use analyze_repository with specific analysis_type for focused insights`

        return {
          content: [{
            type: 'text',
            text: report,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error analyzing repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

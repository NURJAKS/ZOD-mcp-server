import { z } from 'zod'
import { AbstractTool, ToolContext, ToolResult } from '../core/base-tool'
import { RepositoryIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'
import { configManager } from '../core/config-manager'

// Repository tool using the new extensible architecture
export class RepositoryTool extends AbstractTool {
  name = 'repository_tools'
  description = 'Unified repository management tool with 6 functions: index, list, check status, delete, rename, and search repositories'
  
  schema = z.object({
    action: z.enum(['index', 'list', 'check_status', 'delete', 'rename', 'search']).describe('Action to perform'),
    repo_url: z.string().optional().describe('GitHub repository URL (required for index action)'),
    branch: z.string().optional().describe('Branch to index (defaults to main branch, used with index action)'),
    repository: z.string().optional().describe('Repository in owner/repo format (used with check_status, delete, rename actions)'),
    new_name: z.string().optional().describe('New display name for rename action (1-100 characters)'),
    query: z.string().optional().describe('Search query for search action'),
    repositories: z.array(z.string()).optional().describe('List of repositories to search (owner/repo format, used with search action)'),
    include_sources: z.boolean().optional().default(true).describe('Whether to include source code in search results'),
  })

  private repositoryIndexer: RepositoryIndexer | null = null
  private searchEngine: SearchEngine | null = null

  // Lifecycle hooks for extensibility
  protected async beforeExecute(params: any, context: ToolContext): Promise<void> {
    // Initialize services if needed
    if (!this.repositoryIndexer) {
      this.repositoryIndexer = new RepositoryIndexer()
      await this.repositoryIndexer.initialize()
    }
    
    if (!this.searchEngine) {
      this.searchEngine = new SearchEngine()
      await this.searchEngine.initialize()
    }

    // Log execution for debugging
    if (configManager.get('logging').level === 'debug') {
      console.log(`🔧 Executing ${this.name} with action: ${params.action}`)
    }
  }

  protected async executeTool(params: any, context: ToolContext): Promise<ToolResult> {
    const { action, repo_url, branch, repository, new_name, query, repositories, include_sources } = params

    switch (action) {
      case 'index':
        return await this.handleIndexRepository(repo_url, branch)
      
      case 'list':
        return await this.handleListRepositories()
      
      case 'check_status':
        return await this.handleCheckRepositoryStatus(repository)
      
      case 'delete':
        return await this.handleDeleteRepository(repository)
      
      case 'rename':
        return await this.handleRenameRepository(repository, new_name)
      
      case 'search':
        return await this.handleSearchCodebase(query, repositories, include_sources)
      
      default:
        return {
          content: [{
            type: 'error',
            text: `❌ Invalid action: ${action}\n\nAvailable actions: index, list, check_status, delete, rename, search`,
          }],
        }
    }
  }

  protected async afterExecute(result: ToolResult, context: ToolContext): Promise<void> {
    // Post-execution logging
    if (configManager.get('logging').level === 'debug') {
      console.log(`✅ ${this.name} execution completed`)
    }

    // You could add metrics, caching, or other post-processing here
  }

  private async handleIndexRepository(repo_url?: string, branch?: string): Promise<ToolResult> {
    if (!repo_url) {
      return {
        content: [{
          type: 'error',
          text: '❌ Repository URL is required for indexing',
        }],
      }
    }

    try {
      const result = await this.repositoryIndexer!.indexRepository(repo_url, branch)
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully indexed repository: ${repo_url}`,
        }],
        metadata: { indexed: true, repository: repo_url, branch },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to index repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }

  private async handleListRepositories(): Promise<ToolResult> {
    try {
      const repositories = await this.repositoryIndexer!.listRepositories()
      return {
        content: [{
          type: 'text',
          text: `📋 Found ${repositories.length} repositories:\n${repositories.map(repo => `- ${repo.name}`).join('\n')}`,
        }],
        metadata: { count: repositories.length, repositories },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to list repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }

  private async handleCheckRepositoryStatus(repository?: string): Promise<ToolResult> {
    if (!repository) {
      return {
        content: [{
          type: 'error',
          text: '❌ Repository name is required for status check',
        }],
      }
    }

    try {
      const status = await this.repositoryIndexer!.checkRepositoryStatus(repository)
      return {
        content: [{
          type: 'text',
          text: `📊 Repository status for ${repository}: ${status.status}`,
        }],
        metadata: { repository, status },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to check repository status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }

  private async handleDeleteRepository(repository?: string): Promise<ToolResult> {
    if (!repository) {
      return {
        content: [{
          type: 'error',
          text: '❌ Repository name is required for deletion',
        }],
      }
    }

    try {
      await this.repositoryIndexer!.deleteRepository(repository)
      return {
        content: [{
          type: 'text',
          text: `🗑️ Successfully deleted repository: ${repository}`,
        }],
        metadata: { deleted: true, repository },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to delete repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }

  private async handleRenameRepository(repository?: string, new_name?: string): Promise<ToolResult> {
    if (!repository || !new_name) {
      return {
        content: [{
          type: 'error',
          text: '❌ Repository name and new name are required for renaming',
        }],
      }
    }

    try {
      await this.repositoryIndexer!.renameRepository(repository, new_name)
      return {
        content: [{
          type: 'text',
          text: `✏️ Successfully renamed repository from ${repository} to ${new_name}`,
        }],
        metadata: { renamed: true, oldName: repository, newName: new_name },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to rename repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }

  private async handleSearchCodebase(query?: string, repositories?: string[], include_sources?: boolean): Promise<ToolResult> {
    if (!query) {
      return {
        content: [{
          type: 'error',
          text: '❌ Search query is required',
        }],
      }
    }

    try {
      const results = await this.searchEngine!.searchCodebase(query, repositories, include_sources)
      return {
        content: [{
          type: 'text',
          text: `🔍 Search results for "${query}":\n${results.map(result => `- ${result.title}: ${result.snippet}`).join('\n')}`,
        }],
        metadata: { query, results, count: results.length },
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: `❌ Failed to search codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    }
  }
} 
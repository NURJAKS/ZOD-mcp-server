import type { McpToolContext } from '../types'
import { z } from 'zod'
import { DocumentationIndexer } from '../core/indexer'
import { SearchEngine } from '../core/search'
import { safeLog } from '../utils'
import { DatabaseManager } from '../core/database'

// Создаем глобальные экземпляры
let documentationIndexer: DocumentationIndexer | null = null
let searchEngine: SearchEngine | null = null
let db: DatabaseManager | null = null

// Инициализируем компоненты асинхронно
async function initializeComponents() {
  try {
    db = new DatabaseManager()
    documentationIndexer = new DocumentationIndexer()
    searchEngine = new SearchEngine()

    await Promise.all([
      db.initialize(),
      documentationIndexer.initialize(),
      searchEngine.initialize(),
    ])

    safeLog('✅ Documentation components initialized successfully')
  } catch (error) {
    safeLog(`❌ Failed to initialize documentation components: ${error}`, 'error')
  }
}

// Запускаем инициализацию
initializeComponents()

export function registerDocumentationTools({ mcp }: McpToolContext): void {
  // Enhanced Documentation Tools Plugin
  // Supports wildcard patterns, recursive crawling, and comprehensive documentation management

  mcp.tool(
    'documentation_tools',
    'Unified documentation management tool with 7 functions: index, list, check status, delete, rename, search, and analyze documentation. Supports wildcard URL patterns for comprehensive crawling.',
    {
      action: z.enum(['index', 'list', 'check_status', 'delete', 'rename', 'search', 'analyze']).describe('Action to perform'),
      url: z.string().optional().describe('URL of the documentation site to index (required for index action)'),
      url_patterns: z.array(z.string()).optional().describe('URL patterns to include in crawling. Supports wildcards: ["/docs/components/*", "/guide/*", "/api/*"]'),
      max_age: z.number().optional().describe('Maximum age of cached content in seconds'),
      only_main_content: z.boolean().optional().default(true).describe('Extract only main content (removes navigation, ads, etc.)'),
      source_id: z.string().optional().describe('Documentation source ID (used with check_status, delete, rename, analyze actions)'),
      new_name: z.string().optional().describe('New display name for rename action (1-100 characters)'),
      query: z.string().optional().describe('Search query for search action'),
      sources: z.array(z.string()).optional().describe('List of documentation source IDs to search (used with search action)'),
      include_sources: z.boolean().optional().default(true).describe('Whether to include source references in results'),
    },
    async ({ action, url, url_patterns, max_age, only_main_content, source_id, new_name, query, sources, include_sources }) => {
      try {
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }

        switch (action) {
          case 'index':
            return await handleIndexDocumentation(url, url_patterns, max_age, only_main_content)
          
          case 'list':
            return await handleListDocumentation()
          
          case 'check_status':
            return await handleCheckDocumentationStatus(source_id)
          
          case 'delete':
            return await handleDeleteDocumentation(source_id)
          
          case 'rename':
            return await handleRenameDocumentation(source_id, new_name)
          
          case 'search':
            return await handleSearchDocumentation(query, sources, include_sources)
          
          case 'analyze':
            return await handleAnalyzeDocumentation(source_id)
          
          default:
            return {
              content: [{
                type: 'text' as const,
                text: `❌ Invalid action: ${action}\n\nAvailable actions: index, list, check_status, delete, rename, search, analyze`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Documentation tools error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Aliased tools following explicit names from spec
  

  

  

  

  

  
}

// Helper functions for each action
async function handleIndexDocumentation(url?: string, url_patterns?: string[], max_age?: number, only_main_content?: boolean) {
  if (!url?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a documentation URL.\n\nExample: documentation_tools(action="index", url="https://docs.example.com", url_patterns=["/docs/components/*"])`,
      }],
    }
  }

  // Validate URL patterns if provided
  if (url_patterns && url_patterns.length > 0) {
    const invalidPatterns = url_patterns.filter(pattern => !pattern || pattern.trim() === '')
    if (invalidPatterns.length > 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Invalid URL patterns detected: ${invalidPatterns.join(', ')}\n\nValid examples:\n• ["/docs/components/*"]\n• ["/guide/*", "/api/*"]\n• ["/docs/*"]`,
        }],
      }
    }
  }

  const result = await documentationIndexer!.indexDocumentation(url, {
    urlPatterns: url_patterns,
    maxAge: max_age,
    onlyMainContent: only_main_content,
  })

  let patternInfo = ''
  if (url_patterns && url_patterns.length > 0) {
    patternInfo = `\nURL Patterns: ${url_patterns.join(', ')}\nWildcard Support: ✅ Enabled\nRecursive Crawling: ✅ Enabled`
  }

  return {
    content: [{
      type: 'text' as const,
      text: `✅ Documentation indexing started for ${result.name}\n\nStatus: ${result.status}\nProgress: ${result.progress}%\nURL: ${result.url}\nSource ID: ${result.id}${patternInfo}\n\nUse documentation_tools(action="check_status", source_id="${result.id}") to monitor progress.`,
    }],
  }
}

async function handleListDocumentation() {
  const documentation = await documentationIndexer!.listDocumentation()

  if (documentation.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: '📚 No indexed documentation found.\n\nUse documentation_tools(action="index", url="https://docs.example.com") to start indexing a documentation site.',
      }],
    }
  }

  const docList = documentation.map(doc =>
    `• ${doc.name} (${doc.id})\n  URL: ${doc.url}\n  Status: ${doc.status} | Progress: ${doc.progress}% | Pages: ${doc.indexedPages}/${doc.totalPages}`,
  ).join('\n\n')

  return {
    content: [{
      type: 'text' as const,
      text: `📚 Indexed Documentation (${documentation.length}):\n\n${docList}`,
    }],
  }
}

async function handleCheckDocumentationStatus(source_id?: string) {
  if (!source_id?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a documentation source ID.\n\nExample: documentation_tools(action="check_status", source_id="source_id")`,
      }],
    }
  }

  const status = await documentationIndexer!.checkDocumentationStatus(source_id)

  if (!status) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Documentation source "${source_id}" not found.\n\nUse documentation_tools(action="list") to see available documentation sources.`,
      }],
    }
  }

  const statusText = `📊 Documentation Status: ${status.name}\n\n`
    + `Source ID: ${status.id}\n`
    + `URL: ${status.url}\n`
    + `Status: ${status.status}\n`
    + `Progress: ${status.progress}%\n`
    + `Pages Indexed: ${status.indexedPages}/${status.totalPages}\n`
    + `Last Indexed: ${status.lastIndexed.toLocaleString()}\n${status.error ? `Error: ${status.error}` : ''}`

  return {
    content: [{
      type: 'text' as const,
      text: statusText,
    }],
  }
}

async function handleDeleteDocumentation(source_id?: string) {
  if (!source_id?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a documentation source ID.\n\nExample: documentation_tools(action="delete", source_id="source_id")`,
      }],
    }
  }

  const deleted = await documentationIndexer!.deleteDocumentation(source_id)

  if (deleted) {
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Documentation source "${source_id}" has been deleted from the index.`,
      }],
    }
  } else {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Documentation source "${source_id}" not found in the index.`,
      }],
    }
  }
}

async function handleRenameDocumentation(source_id?: string, new_name?: string) {
  if (!source_id?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a documentation source ID.\n\nExample: documentation_tools(action="rename", source_id="source_id", new_name="New Name")`,
      }],
    }
  }

  if (!new_name?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a new name.\n\nExample: documentation_tools(action="rename", source_id="source_id", new_name="New Name")`,
      }],
    }
  }

  const renamed = await documentationIndexer!.renameDocumentation(source_id, new_name)

  if (renamed) {
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Documentation source "${source_id}" has been renamed to "${new_name}".`,
      }],
    }
  } else {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Documentation source "${source_id}" not found in the index.`,
      }],
    }
  }
}

async function handleSearchDocumentation(query?: string, sources?: string[], include_sources?: boolean) {
  if (!searchEngine) {
    throw new Error('Search engine not initialized')
  }

  if (!query?.trim()) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a search query.\n\nExample: documentation_tools(action="search", query="API documentation")`,
      }],
    }
  }

  const results = await searchEngine.searchDocumentation(query, {
    sources,
    includeSources: include_sources,
    maxResults: 10,
  })

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `🔍 No documentation results found for query: "${query}"\n\nTry:\n• Using more specific keywords\n• Checking if documentation is indexed\n• Using different search terms`,
      }],
    }
  }

  const resultsText = results.map((result, index) =>
    `${index + 1}. **${result.title}**\n`
    + `   Score: ${(result.score * 100).toFixed(1)}%\n`
    + `   ${result.content}\n${result.url ? `   Source: ${result.url}\n` : ''
    }   Metadata: ${JSON.stringify(result.metadata)}\n`,
  ).join('\n')

  return {
    content: [{
      type: 'text' as const,
      text: `🔍 Documentation Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}`,
    }],
  }
}

async function handleAnalyzeDocumentation(source_id?: string) {
  if (!source_id || source_id.trim() === '') {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Please provide a valid documentation source ID.\n\nUse documentation_tools(action="list") to see available sources.`,
      }],
    }
  }

  if (!documentationIndexer || !db) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Documentation components not initialized. Please try again.`,
      }],
    }
  }

  // Get documentation record
  const record = await documentationIndexer.checkDocumentationStatus(source_id)
  if (!record) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Documentation source not found: ${source_id}\n\nUse documentation_tools(action="list") to see available sources.`,
      }],
    }
  }

  // Get documentation pages from database
  const pages = await db.getIndexedPages(source_id)
  
  // Analyze content
  const totalPages = pages.length
  const totalContent = pages.reduce((sum, page) => sum + page.content.length, 0)
  const avgContentLength = totalPages > 0 ? Math.round(totalContent / totalPages) : 0
  
  // Language detection (simple)
  const englishWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will', 'been']
  const codePatterns = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'return', 'if', 'else']
  
  let englishContent = 0
  let codeContent = 0
  
  pages.forEach(page => {
    const words = page.content.toLowerCase().split(/\s+/)
    englishContent += words.filter(word => englishWords.includes(word)).length
    codeContent += words.filter(word => codePatterns.includes(word)).length
  })

  const contentQuality = {
    total_pages: totalPages,
    total_content_chars: totalContent,
    avg_content_length: avgContentLength,
    english_ratio: totalContent > 0 ? (englishContent / totalContent * 100).toFixed(1) : '0',
    code_ratio: totalContent > 0 ? (codeContent / totalContent * 100).toFixed(1) : '0',
    unique_urls: new Set(pages.map(p => p.url)).size,
    avg_title_length: pages.length > 0 ? Math.round(pages.reduce((sum, p) => sum + p.title.length, 0) / pages.length) : 0
  }

  // Structure analysis
  const structureAnalysis = {
    has_index_page: pages.some(p => p.url.endsWith('/') || p.url.endsWith('/index.html')),
    has_search: pages.some(p => p.content.toLowerCase().includes('search')),
    has_navigation: pages.some(p => p.content.toLowerCase().includes('nav') || p.content.toLowerCase().includes('menu')),
    has_toc: pages.some(p => p.content.toLowerCase().includes('table of contents') || p.content.toLowerCase().includes('toc')),
    max_depth: Math.max(...pages.map(p => (p.url.match(/\//g) || []).length))
  }

  let report = `🔍 **Documentation Analysis: ${record.displayName || record.name}**\n\n`
  report += `📊 **Source Info:**\n`
  report += `• URL: ${record.url}\n`
  report += `• Status: ${record.status}\n`
  report += `• Pages Indexed: ${record.indexedPages}\n`
  report += `• Last Indexed: ${new Date(record.lastIndexed).toLocaleDateString()}\n\n`

  report += `📝 **Content Quality:**\n`
  report += `• Total Pages: ${contentQuality.total_pages}\n`
  report += `• Total Content: ${contentQuality.total_content_chars.toLocaleString()} characters\n`
  report += `• Average Content Length: ${contentQuality.avg_content_length} characters\n`
  report += `• English Content Ratio: ${contentQuality.english_ratio}%\n`
  report += `• Code Content Ratio: ${contentQuality.code_ratio}%\n`
  report += `• Unique URLs: ${contentQuality.unique_urls}\n`
  report += `• Average Title Length: ${contentQuality.avg_title_length} characters\n\n`

  report += `🏗️ **Structure Analysis:**\n`
  report += `• Has Index Page: ${structureAnalysis.has_index_page ? '✅' : '❌'}\n`
  report += `• Has Search: ${structureAnalysis.has_search ? '✅' : '❌'}\n`
  report += `• Has Navigation: ${structureAnalysis.has_navigation ? '✅' : '❌'}\n`
  report += `• Has Table of Contents: ${structureAnalysis.has_toc ? '✅' : '❌'}\n`
  report += `• Max URL Depth: ${structureAnalysis.max_depth} levels\n\n`

  report += `**Next Steps:**\n`
  report += `• Use documentation_tools(action="search", query="your query") to search this documentation\n`
  report += `• Consider re-indexing if content has changed significantly`

  return {
    content: [{
      type: 'text' as const,
      text: report,
    }],
  }
}
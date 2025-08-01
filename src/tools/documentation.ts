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
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }
        const result = await documentationIndexer.indexDocumentation(url, {
          urlPatterns: url_patterns,
          maxAge: max_age,
          onlyMainContent: only_main_content,
        })

        return {
          content: [{
            type: 'text',
            text: `✅ Documentation indexing started for ${result.name}\n\nStatus: ${result.status}\nProgress: ${result.progress}%\nURL: ${result.url}\nSource ID: ${result.id}\n\nUse check_documentation_status to monitor progress.`,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error indexing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }
        const documentation = await documentationIndexer.listDocumentation()

        if (documentation.length === 0) {
          return {
            content: [{
              type: 'text',
              text: '📚 No indexed documentation found.\n\nUse index_documentation to start indexing a documentation site.',
            }],
          }
        }

        const docList = documentation.map(doc =>
          `• ${doc.name} (${doc.id})\n  URL: ${doc.url}\n  Status: ${doc.status} | Progress: ${doc.progress}% | Pages: ${doc.indexedPages}/${doc.totalPages}`,
        ).join('\n\n')

        return {
          content: [{
            type: 'text',
            text: `📚 Indexed Documentation (${documentation.length}):\n\n${docList}`,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error listing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }
        const status = await documentationIndexer.checkDocumentationStatus(source_id)

        if (!status) {
          return {
            content: [{
              type: 'text',
              text: `❌ Documentation source "${source_id}" not found.\n\nUse list_documentation to see available documentation sources.`,
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
            type: 'text',
            text: statusText,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error checking documentation status: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }
        const deleted = await documentationIndexer.deleteDocumentation(source_id)

        if (deleted) {
          return {
            content: [{
              type: 'text',
              text: `✅ Documentation source "${source_id}" has been deleted from the index.`,
            }],
          }
        }
        else {
          return {
            content: [{
              type: 'text',
              text: `❌ Documentation source "${source_id}" not found in the index.`,
            }],
          }
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error deleting documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        if (!documentationIndexer) {
          throw new Error('Documentation indexer not initialized')
        }
        const renamed = await documentationIndexer.renameDocumentation(source_id, new_name)

        if (renamed) {
          return {
            content: [{
              type: 'text',
              text: `✅ Documentation source "${source_id}" has been renamed to "${new_name}".`,
            }],
          }
        }
        else {
          return {
            content: [{
              type: 'text',
              text: `❌ Documentation source "${source_id}" not found in the index.`,
            }],
          }
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error renaming documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        if (!searchEngine) {
          throw new Error('Search engine not initialized')
        }
        const results = await searchEngine.searchDocumentation(query, {
          sources,
          includeSources: include_sources,
          maxResults: 10,
        })

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
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
            type: 'text',
            text: `🔍 Documentation Search Results for: "${query}"\n\nFound ${results.length} results:\n\n${resultsText}`,
          }],
        }
      }
      catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )

  // Advanced documentation analysis tool
  mcp.tool(
    'analyze_documentation',
    'Perform comprehensive analysis of documentation including content quality, structure, and SEO insights',
    {
      source_id: z.string().describe('Documentation source ID to analyze'),
      analysis_type: z.enum(['full', 'content', 'structure', 'seo', 'accessibility']).default('full').describe('Type of analysis to perform'),
    },
    async ({ source_id, analysis_type }) => {
      try {
        if (!source_id || source_id.trim() === '') {
          return {
            content: [{
              type: 'text',
              text: `❌ Please provide a valid documentation source ID.\n\nUse list_documentation to see available sources.`,
            }],
          }
        }

        if (!documentationIndexer || !db) {
          return {
            content: [{
              type: 'text',
              text: `❌ Documentation components not initialized. Please try again.`,
            }],
          }
        }

        // Get documentation record
        const record = await documentationIndexer.checkDocumentationStatus(source_id)
        if (!record) {
          return {
            content: [{
              type: 'text',
              text: `❌ Documentation source not found: ${source_id}\n\nUse list_documentation to see available sources.`,
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

        // SEO analysis
        const seoAnalysis = {
          has_meta_tags: pages.some(p => p.content.toLowerCase().includes('<meta')),
          has_structured_data: pages.some(p => p.content.toLowerCase().includes('json-ld') || p.content.toLowerCase().includes('schema.org')),
          has_social_tags: pages.some(p => p.content.toLowerCase().includes('og:') || p.content.toLowerCase().includes('twitter:')),
          has_canonical: pages.some(p => p.content.toLowerCase().includes('canonical')),
          avg_title_length: contentQuality.avg_title_length,
          title_optimization: contentQuality.avg_title_length >= 30 && contentQuality.avg_title_length <= 60 ? 'Good' : 'Needs improvement'
        }

        // Accessibility analysis
        const accessibilityAnalysis = {
          has_alt_text: pages.some(p => p.content.toLowerCase().includes('alt=')),
          has_aria_labels: pages.some(p => p.content.toLowerCase().includes('aria-')),
          has_semantic_html: pages.some(p => p.content.toLowerCase().includes('<nav>') || p.content.toLowerCase().includes('<main>') || p.content.toLowerCase().includes('<article>')),
          has_skip_links: pages.some(p => p.content.toLowerCase().includes('skip to main content')),
          has_contrast_issues: pages.some(p => p.content.toLowerCase().includes('color: #') && p.content.toLowerCase().includes('background: #'))
        }

        let report = `🔍 **Documentation Analysis: ${record.displayName || record.name}**\n\n`
        report += `📊 **Source Info:**\n`
        report += `• URL: ${record.url}\n`
        report += `• Status: ${record.status}\n`
        report += `• Pages Indexed: ${record.indexedPages}\n`
        report += `• Last Indexed: ${new Date(record.lastIndexed).toLocaleDateString()}\n\n`

        if (analysis_type === 'full' || analysis_type === 'content') {
          report += `📝 **Content Quality:**\n`
          report += `• Total Pages: ${contentQuality.total_pages}\n`
          report += `• Total Content: ${contentQuality.total_content_chars.toLocaleString()} characters\n`
          report += `• Average Content Length: ${contentQuality.avg_content_length} characters\n`
          report += `• English Content Ratio: ${contentQuality.english_ratio}%\n`
          report += `• Code Content Ratio: ${contentQuality.code_ratio}%\n`
          report += `• Unique URLs: ${contentQuality.unique_urls}\n`
          report += `• Average Title Length: ${contentQuality.avg_title_length} characters\n\n`
        }

        if (analysis_type === 'full' || analysis_type === 'structure') {
          report += `🏗️ **Structure Analysis:**\n`
          report += `• Has Index Page: ${structureAnalysis.has_index_page ? '✅' : '❌'}\n`
          report += `• Has Search: ${structureAnalysis.has_search ? '✅' : '❌'}\n`
          report += `• Has Navigation: ${structureAnalysis.has_navigation ? '✅' : '❌'}\n`
          report += `• Has Table of Contents: ${structureAnalysis.has_toc ? '✅' : '❌'}\n`
          report += `• Max URL Depth: ${structureAnalysis.max_depth} levels\n\n`
        }

        if (analysis_type === 'full' || analysis_type === 'seo') {
          report += `🔍 **SEO Analysis:**\n`
          report += `• Meta Tags: ${seoAnalysis.has_meta_tags ? '✅' : '❌'}\n`
          report += `• Structured Data: ${seoAnalysis.has_structured_data ? '✅' : '❌'}\n`
          report += `• Social Tags: ${seoAnalysis.has_social_tags ? '✅' : '❌'}\n`
          report += `• Canonical URLs: ${seoAnalysis.has_canonical ? '✅' : '❌'}\n`
          report += `• Title Optimization: ${seoAnalysis.title_optimization}\n\n`
        }

        if (analysis_type === 'full' || analysis_type === 'accessibility') {
          report += `♿ **Accessibility Analysis:**\n`
          report += `• Alt Text: ${accessibilityAnalysis.has_alt_text ? '✅' : '❌'}\n`
          report += `• ARIA Labels: ${accessibilityAnalysis.has_aria_labels ? '✅' : '❌'}\n`
          report += `• Semantic HTML: ${accessibilityAnalysis.has_semantic_html ? '✅' : '❌'}\n`
          report += `• Skip Links: ${accessibilityAnalysis.has_skip_links ? '✅' : '❌'}\n`
          report += `• Contrast Issues: ${accessibilityAnalysis.has_contrast_issues ? '⚠️' : '✅'}\n\n`
        }

        report += `**Next Steps:**\n`
        report += `• Use search_documentation to search this documentation\n`
        report += `• Use analyze_documentation with specific analysis_type for focused insights\n`
        report += `• Consider re-indexing if content has changed significantly`

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
            text: `❌ Error analyzing documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

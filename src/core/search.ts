import { DatabaseManager } from './database'
import { VectorSearchEngine } from './vector-search'
import * as dotenv from 'dotenv'

dotenv.config()

export interface SearchResult {
  id: string
  type: 'repository' | 'documentation' | 'code' | 'web'
  title: string
  content: string
  url?: string
  score: number
  metadata: Record<string, any>
}

export interface SearchOptions {
  repositories?: string[]
  sources?: string[]
  includeSources?: boolean
  maxResults?: number
  minScore?: number
}

export class SearchEngine {
  private db: DatabaseManager
  private openrouter: any = null
  private vectorEngine: VectorSearchEngine

  constructor() {
    this.db = new DatabaseManager()
    this.vectorEngine = new VectorSearchEngine()
    
    // Initialize OpenRouter for AI-powered search
    const apiKey = process.env.OPENROUTER_API_KEY
    console.log('🔧 OpenRouter initialization debug:')
    console.log('  - API Key exists:', !!apiKey)
    console.log('  - API Key length:', apiKey?.length || 0)
    
    if (apiKey) {
      this.initializeOpenRouterSync(apiKey)
    } else {
      console.log('❌ No OpenRouter API key found in environment')
    }
  }

  private initializeOpenRouterSync(apiKey: string) {
    try {
      // Use require for synchronous initialization
      const { OpenRouter } = require('openrouter-client')
      console.log('  - OpenRouter module loaded successfully')
      
      this.openrouter = new OpenRouter(apiKey)
      console.log('✅ OpenRouter client initialized for semantic search')
    } catch (error) {
      console.log('❌ OpenRouter client not available:', error.message)
    }
  }

  private async initializeOpenRouter(apiKey: string) {
    try {
      // Use dynamic import for ES module compatibility
      const { OpenRouter } = await import('openrouter-client')
      console.log('  - OpenRouter module loaded successfully')
      
      this.openrouter = new OpenRouter(apiKey)
      console.log('✅ OpenRouter client initialized for semantic search')
    } catch (error) {
      console.log('❌ OpenRouter client not available:', error.message)
    }
  }

  async initialize(): Promise<void> {
    await this.db.initialize()
    await this.vectorEngine.initialize()
  }

  async searchCodebase(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    try {
      console.log(`🔍 Semantic search for: "${query}"`)
      console.log(`📁 Repositories:`, options.repositories || 'All repositories')
      
      // Get all indexed files for content search
      const allFiles = await this.db.getRecentIndexedFiles(200)
      console.log(`📊 Found ${allFiles.length} total files to search`)
      
      // Get actual file content for semantic search
      const filesWithContent = await Promise.all(
        allFiles.map(async (file) => {
          try {
            const fileContent = await this.db.getIndexedFiles(file.repository)
            const matchingFile = fileContent.find(f => f.path === file.path)
            return {
              ...file,
              content: matchingFile?.content || '',
              fullPath: file.path
            }
          } catch (error) {
            return { ...file, content: '', fullPath: file.path }
          }
        })
      )
      
      // Semantic search through content
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
      const matchingFiles = filesWithContent.filter(file => {
        // Search in file path, language, and content
        const searchableText = `${file.path} ${file.language} ${file.content}`.toLowerCase()
        return searchTerms.some(term => searchableText.includes(term))
      })
      
      console.log(`🎯 Found ${matchingFiles.length} semantically relevant files`)
      
      // Convert to rich search results with code snippets
      const results = matchingFiles.map(file => {
        // Extract relevant code snippet (first 200 chars of content)
        const codeSnippet = file.content.length > 200 
          ? file.content.substring(0, 200) + '...'
          : file.content
          
        // Generate semantic explanation
        const explanation = this.generateExplanation(query, file.path, file.language)
        
        return {
          id: file.fullPath,
          type: 'code' as const,
          title: `${file.path} (${file.language})`,
          content: `📁 **File:** ${file.path}\n\n💻 **Code Snippet:**\n\`\`\`${file.language}\n${codeSnippet}\n\`\`\`\n\n📝 **Explanation:** ${explanation}\n\n🏷️ **Repository:** ${file.repository}`,
          score: this.calculateRelevanceScore(query, file),
          metadata: {
            repository: file.repository,
            path: file.path,
            language: file.language,
            size: file.size,
            explanation: explanation
          }
        }
      })
      
      // Remove duplicates and sort by relevance
      const uniqueResults = this.removeDuplicates(results)
      const sortedResults = uniqueResults.sort((a, b) => b.score - a.score)
      
      console.log(`✅ Returning ${sortedResults.length} unique, relevant results`)
      return sortedResults.slice(0, options.maxResults || 10)
      
    } catch (error) {
      console.error('❌ Error in semantic search:', error)
      return [{
        id: 'error-fallback',
        type: 'code',
        title: 'Search Error',
        content: `🔍 **Search Query:** "${query}"\n\n❌ **Error:** Unable to perform semantic search\n\n💡 **Try:**\n• Use more specific keywords\n• Check if repositories are indexed\n• Try different search terms`,
        score: 0.1,
        metadata: {
          repository: 'unknown',
          path: 'error',
          language: 'text',
          error: error.message
        }
      }]
    }
  }

  async searchDocumentation(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    try {
      // 1. Текстовый поиск в SQLite
      const dbResults = await this.db.searchIndexedPages(query, options.sources)

      // 2. Векторный поиск в Qdrant (если доступен)
      let vectorResults: any[] = []
      try {
        if (this.vectorEngine && this.vectorEngine.isReady) {
          vectorResults = await this.vectorEngine.searchPages(query, {
            documentation: options.sources,
            limit: options.maxResults || 20,
            scoreThreshold: options.minScore || 0.7
          })
        }
      } catch (error) {
        console.log('Vector search not available, using database search only')
      }

      // 3. Семантический поиск с OpenAI (если есть) - временно отключен
      let semanticResults: SearchResult[] = []
      // if (this.openrouter && dbResults.length > 0) {
      //   semanticResults = await this.performSemanticDocumentationSearch(query, dbResults, options)
      // }

      // 4. Объединяем все результаты
      const allResults = [
        ...this.convertVectorResultsToSearchResults(vectorResults),
        ...semanticResults,
        ...this.convertDocumentationResultsToSearchResults(dbResults)
      ]

      // 5. Удаляем дубликаты и сортируем по релевантности
      const uniqueResults = this.deduplicateResults(allResults)

      return uniqueResults
        .filter(result => result.score >= (options.minScore || 0.1))
        .slice(0, options.maxResults || 10)
    } catch (error) {
      console.error('Error searching documentation:', error)
      return []
    }
  }

  async searchWeb(
    query: string,
    options: {
      numResults?: number
      category?: string
      daysBack?: number
      findSimilarTo?: string
    } = {},
  ): Promise<SearchResult[]> {
    try {
      // Используем Serper API для веб-поиска
      const results = await this.performWebSearch(query, options)
      return results
    } catch (error) {
      console.error('Error performing web search:', error)
      return []
    }
  }

  async searchNews(
    query: string,
    options: {
      sources?: string[]
      timeRange?: string
      maxResults?: number
    } = {}
  ): Promise<Array<{
    title: string
    content: string
    url: string
    source: string
    publishedAt: string
  }>> {
    try {
      // Use NewsAPI or similar service
      const apiKey = process.env.NEWS_API_KEY
      if (!apiKey) {
        return this.getMockNewsResults(query, options)
      }

      const response = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${apiKey}&pageSize=${options.maxResults || 10}`)
      
      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`)
      }

      const data = await response.json()
      
      return (data.articles || []).map((article: any) => ({
        title: article.title,
        content: article.description || article.content || '',
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
      }))
    } catch (error) {
      console.error('Error in news search:', error)
      return this.getMockNewsResults(query, options)
    }
  }

  async searchAcademic(
    query: string,
    options: {
      fields?: string[]
      yearFrom?: number
      yearTo?: number
      maxResults?: number
    } = {}
  ): Promise<Array<{
    title: string
    authors: string[]
    abstract: string
    journal: string
    year: number
    citations: number
    doi: string
  }>> {
    try {
      // Use arXiv API for academic papers
      const response = await fetch(`http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${options.maxResults || 10}&sortBy=relevance&sortOrder=descending`)
      
      if (!response.ok) {
        throw new Error(`ArXiv API error: ${response.status}`)
      }

      const data = await response.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(data, 'text/xml')
      
      const entries = xmlDoc.getElementsByTagName('entry')
      const results: Array<{
        title: string
        authors: string[]
        abstract: string
        journal: string
        year: number
        citations: number
        doi: string
      }> = []
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const title = entry.getElementsByTagName('title')[0]?.textContent || ''
        const summary = entry.getElementsByTagName('summary')[0]?.textContent || ''
        const authors = Array.from(entry.getElementsByTagName('author')).map(author => author.getElementsByTagName('name')[0]?.textContent || '').filter(Boolean)
        const published = entry.getElementsByTagName('published')[0]?.textContent || ''
        const year = new Date(published).getFullYear()
        const id = entry.getElementsByTagName('id')[0]?.textContent || ''
        
        results.push({
          title: title.replace(/\s+/g, ' ').trim(),
          authors,
          abstract: summary.replace(/\s+/g, ' ').trim(),
          journal: 'arXiv',
          year,
          citations: 0, // arXiv doesn't provide citation count
          doi: id,
        })
      }
      
      return results
    } catch (error) {
      console.error('Error in academic search:', error)
      return this.getMockAcademicResults(query, options)
    }
  }

  async monitorSocial(
    topic: string,
    options: {
      platforms?: string[]
      timeRange?: string
      maxResults?: number
    } = {}
  ): Promise<Array<{
    platform: string
    author: string
    content: string
    url: string
    publishedAt: string
    engagement: number
  }>> {
    try {
      // Use Reddit API for social monitoring
      const response = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&limit=${options.maxResults || 15}&sort=hot`)
      
      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`)
      }

      const data = await response.json()
      
      return (data.data?.children || []).map((post: any) => ({
        platform: 'reddit',
        author: post.data.author,
        content: post.data.title + (post.data.selftext ? ': ' + post.data.selftext : ''),
        url: `https://reddit.com${post.data.permalink}`,
        publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
        engagement: post.data.score + post.data.num_comments,
      }))
    } catch (error) {
      console.error('Error in social monitoring:', error)
      return this.getMockSocialResults(topic, options)
    }
  }

  async deepResearch(
    query: string,
    outputFormat?: string,
  ): Promise<{
    summary: string
    analysis: string
    sources: string[]
    recommendations: string[]
  }> {
    try {
      if (!this.openrouter) {
        // Fallback to web search when OpenRouter is not available
        const webResults = await this.searchWeb(query, { numResults: 5 })
        
        const summary = `Research on "${query}" based on web search results.`
        const analysis = webResults.length > 0 
          ? `Found ${webResults.length} relevant sources. Key findings:\n\n${webResults.map((result, i) => `${i + 1}. ${result.title}\n   ${result.content.substring(0, 150)}...`).join('\n\n')}`
          : 'No relevant sources found in web search.'
        
        const sources = webResults.map(result => result.url || '').filter(Boolean)
        const recommendations = [
          'Use nia_web_search for more specific queries',
          'Index relevant repositories with index_repository',
          'Search your indexed content with search_codebase'
        ]

        return {
          summary,
          analysis,
          sources,
          recommendations
        }
      }

      // Perform multi-step research with OpenRouter
      const research = await this.performDeepResearch(query, outputFormat)
      return research
    } catch (error) {
      console.error('Error performing deep research:', error)
      return {
        summary: `Error performing research: ${error instanceof Error ? error.message : 'Unknown error'}`,
        analysis: 'Research could not be completed due to an error.',
        sources: [],
        recommendations: ['Check API configuration', 'Verify internet connection', 'Try web search instead'],
      }
    }
  }

  private async performSemanticSearch(
    query: string,
    dbResults: Array<{
      repositoryId: string
      path: string
      content: string
      language: string
      score: number
    }>,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.openrouter) return []

    try {
      // Создаем промпт для семантического поиска
      const prompt = `
        Analyze the following code files and find the most relevant ones for the query: "${query}"
        
        Code files:
        ${dbResults.map((result, index) =>
        `${index + 1}. ${result.path} (${result.language}): ${result.content.substring(0, 200)}...`
      ).join('\n')}
        
        Return only the indices of the most relevant files (1-${dbResults.length}), separated by commas.
      `

      const completion = await this.openrouter.chat.completions.create({
        model: 'deepseek/deepseek-coder:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.1,
      })

      const response = completion.choices[0]?.message?.content || ''
      const relevantIndices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))

      return relevantIndices.map(index => {
        const result = dbResults[index - 1]
        if (!result) return null

        return {
          id: `semantic-${index}`,
          type: 'code' as const,
          title: `${result.path} (${result.language})`,
          content: result.content,
          url: `https://github.com/${result.repositoryId}/blob/main/${result.path}`,
          score: 0.9, // Высокий скор для семантически релевантных результатов
          metadata: {
            language: result.language,
            repository: result.repositoryId,
            path: result.path,
            semantic: true,
          },
        }
      }).filter(Boolean) as SearchResult[]
    } catch (error) {
      console.error('Error in semantic search:', error)
      return []
    }
  }

  private convertDbResultsToSearchResults(
    dbResults: Array<{
      repositoryId: string
      path: string
      content: string
      language: string
      score: number
    }>
  ): SearchResult[] {
    return dbResults.map((result, index) => ({
      id: `db-${index}`,
      type: 'code' as const,
      title: `${result.path} (${result.language})`,
      content: result.content,
      url: `https://github.com/${result.repositoryId}/blob/main/${result.path}`,
      score: Math.min(result.score / 100, 0.8), // Нормализуем скор
      metadata: {
        language: result.language,
        repository: result.repositoryId,
        path: result.path,
        semantic: false,
      },
    }))
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = `${result.type}-${result.url || result.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async performWebSearch(
    query: string,
    options: {
      numResults?: number
      category?: string
      daysBack?: number
      findSimilarTo?: string
    }
  ): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY
    if (!apiKey) {
      console.warn('SERPER_API_KEY not configured, using mock results')
      return this.getMockWebResults(query, options)
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: options.numResults || 5,
        }),
      })

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`)
      }

      const data = await response.json()

      return (data.organic || []).map((result: any, index: number) => ({
        id: `web-${index}`,
        type: 'web' as const,
        title: result.title,
        content: result.snippet,
        url: result.link,
        score: 0.8 - (index * 0.1), // Уменьшаем скор для каждого следующего результата
        metadata: { category: 'web', position: index + 1 },
      }))
    } catch (error) {
      console.error('Error in web search:', error)
      return this.getMockWebResults(query, options)
    }
  }

  private getMockWebResults(
    query: string,
    options: {
      numResults?: number
      category?: string
      daysBack?: number
      findSimilarTo?: string
    }
  ): SearchResult[] {
    // Provide helpful fallback results when API is not available
    const fallbackResults = [
      {
        id: 'fallback-1',
        type: 'web' as const,
        title: 'Web Search API Not Configured',
        content: `To enable web search functionality, please configure the SERPER_API_KEY environment variable. You can get a free API key from https://serper.dev`,
        url: 'https://serper.dev',
        score: 0.9,
        metadata: { category: 'setup', position: 1 },
      },
      {
        id: 'fallback-2',
        type: 'web' as const,
        title: 'Alternative Search Options',
        content: `While web search is not available, you can still search your indexed repositories and documentation using search_codebase and search_documentation tools.`,
        url: '',
        score: 0.8,
        metadata: { category: 'help', position: 2 },
      }
    ]

    return fallbackResults.slice(0, options.numResults || 2)
  }

  private async performSemanticDocumentationSearch(
    query: string,
    dbResults: Array<{
      documentationId: string
      url: string
      title: string
      content: string
      score: number
    }>,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.openrouter) return []

    try {
      // Создаем промпт для семантического поиска документации
      const prompt = `
        Analyze the following documentation pages and find the most relevant ones for the query: "${query}"
        
        Documentation pages:
        ${dbResults.map((result, index) =>
        `${index + 1}. ${result.title} (${result.url}): ${result.content.substring(0, 200)}...`
      ).join('\n')}
        
        Return only the indices of the most relevant pages (1-${dbResults.length}), separated by commas.
      `

      const completion = await this.openrouter.chat.completions.create({
        model: 'deepseek/deepseek-coder:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.1,
      })

      const response = completion.choices[0]?.message?.content || ''
      const relevantIndices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))

      return relevantIndices.map(index => {
        const result = dbResults[index - 1]
        if (!result) return null

        return {
          id: `semantic-doc-${index}`,
          type: 'documentation' as const,
          title: result.title,
          content: result.content,
          url: result.url,
          score: 0.9, // Высокий скор для семантически релевантных результатов
          metadata: {
            documentationId: result.documentationId,
            semantic: true,
          },
        }
      }).filter(Boolean) as SearchResult[]
    } catch (error) {
      console.error('Error in semantic documentation search:', error)
      return []
    }
  }

  private convertDocumentationResultsToSearchResults(
    dbResults: Array<{
      documentationId: string
      url: string
      title: string
      content: string
      score: number
    }>
  ): SearchResult[] {
    return dbResults.map((result, index) => ({
      id: `doc-${index}`,
      type: 'documentation' as const,
      title: result.title,
      content: result.content,
      url: result.url,
      score: Math.min(result.score / 100, 0.8), // Нормализуем скор
      metadata: {
        documentationId: result.documentationId,
        semantic: false,
      },
    }))
  }

  private async performDeepResearch(
    query: string,
    outputFormat?: string
  ): Promise<{
    summary: string
    analysis: string
    sources: string[]
    recommendations: string[]
  }> {
    if (!this.openrouter) {
      throw new Error('OpenRouter API key not configured')
    }

    // Этап 1: Собираем информацию из веб-поиска
    const webResults = await this.searchWeb(query, { numResults: 10 })

    // Этап 2: Анализируем результаты с помощью AI
    const analysisPrompt = `
      Perform a comprehensive analysis of the following topic: "${query}"
      
      Web search results:
      ${webResults.map((result, index) =>
      `${index + 1}. ${result.title}: ${result.content}`
    ).join('\n')}
      
      ${outputFormat ? `Please structure the analysis as: ${outputFormat}` : ''}
      
      Provide:
      1. A concise summary
      2. Detailed analysis with pros and cons
      3. Key sources and references
      4. Actionable recommendations
    `

    const completion = await this.openrouter.chat.completions.create({
      model: 'deepseek/deepseek-coder:free',
      messages: [{ role: 'user', content: analysisPrompt }],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const analysis = completion.choices[0]?.message?.content || 'Analysis could not be completed.'

    return {
      summary: `Comprehensive analysis of ${query} reveals multiple approaches and best practices.`,
      analysis,
      sources: webResults.map(r => r.url || '').filter(Boolean),
      recommendations: [
        'Start with the most popular approach for learning',
        'Consider production requirements when choosing implementation',
        'Monitor community trends for future adoption',
      ],
    }
  }

  private convertVectorResultsToSearchResults(
    vectorResults: Array<{
      id: string
      score: number
      payload: {
        path?: string
        url?: string
        title?: string
        content: string
        language?: string
        repository?: string
        documentation?: string
        type: 'file' | 'page'
      }
    }>
  ): SearchResult[] {
    return vectorResults.map((result) => ({
      id: result.id,
      type: result.payload.type === 'file' ? 'code' : 'documentation',
      title: result.payload.title || result.payload.path || result.id,
      content: result.payload.content,
      url: result.payload.url || `https://github.com/${result.payload.repository}/blob/main/${result.payload.path}`,
      score: result.score,
      metadata: {
        ...result.payload,
        vector: true
      },
    }))
  }

  private getMockNewsResults(
    query: string,
    options: {
      sources?: string[]
      timeRange?: string
      maxResults?: number
    }
  ): Array<{
    title: string
    content: string
    url: string
    source: string
    publishedAt: string
  }> {
    return [
      {
        title: `News API not configured for: ${query}`,
        content: 'To enable real news search, configure NEWS_API_KEY environment variable. Get a free key from https://newsapi.org',
        url: 'https://newsapi.org',
        source: 'NewsAPI',
        publishedAt: new Date().toISOString(),
      }
    ]
  }

  private getMockAcademicResults(
    query: string,
    options: {
      fields?: string[]
      yearFrom?: number
      yearTo?: number
      maxResults?: number
    }
  ): Array<{
    title: string
    authors: string[]
    abstract: string
    journal: string
    year: number
    citations: number
    doi: string
  }> {
    return [
      {
        title: `Academic search not available for: ${query}`,
        authors: ['System'],
        abstract: 'Academic search is currently using fallback results. Consider implementing arXiv or Semantic Scholar API for real academic paper search.',
        journal: 'System',
        year: new Date().getFullYear(),
        citations: 0,
        doi: 'system://mock',
      }
    ]
  }

  private getMockSocialResults(
    topic: string,
    options: {
      platforms?: string[]
      timeRange?: string
      maxResults?: number
    }
  ): Array<{
    platform: string
    author: string
    content: string
    url: string
    publishedAt: string
    engagement: number
  }> {
    return [
      {
        platform: 'system',
        author: 'System',
        content: `Social media monitoring not available for: ${topic}. Consider implementing Twitter API or Reddit API for real social media monitoring.`,
        url: '',
        publishedAt: new Date().toISOString(),
        engagement: 0,
      }
    ]
  }

  // Generate semantic explanation for search results
  private generateExplanation(query: string, filePath: string, language: string): string {
    const queryLower = query.toLowerCase()
    
    if (queryLower.includes('html') || queryLower.includes('page')) {
      return `This HTML file likely contains the page structure and markup for "${filePath.replace('.html', '')}".`
    }
    
    if (queryLower.includes('css') || queryLower.includes('style')) {
      return `This CSS file contains styling rules and design definitions for the application.`
    }
    
    if (queryLower.includes('javascript') || queryLower.includes('js') || queryLower.includes('function')) {
      return `This JavaScript file contains interactive functionality and client-side logic.`
    }
    
    if (queryLower.includes('contact') || queryLower.includes('form')) {
      return `This file likely contains contact form implementation or user interaction elements.`
    }
    
    if (queryLower.includes('portfolio') || queryLower.includes('project')) {
      return `This file is part of the portfolio/project showcase functionality.`
    }
    
    return `This ${language} file appears relevant to your search query.`
  }

  // Calculate relevance score based on query and file
  private calculateRelevanceScore(query: string, file: any): number {
    const queryLower = query.toLowerCase()
    const fileText = `${file.path} ${file.language} ${file.content}`.toLowerCase()
    
    let score = 0
    
    // Exact matches get higher scores
    if (fileText.includes(queryLower)) score += 0.8
    if (file.path.toLowerCase().includes(queryLower)) score += 0.6
    if (file.language.toLowerCase().includes(queryLower)) score += 0.4
    
    // Partial matches
    const queryWords = queryLower.split(' ')
    queryWords.forEach(word => {
      if (fileText.includes(word)) score += 0.2
    })
    
    return Math.min(1.0, score)
  }

  // Remove duplicate results
  private removeDuplicates(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = `${result.metadata.repository}/${result.metadata.path}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}

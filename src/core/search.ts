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

    // OpenRouter временно отключен
    // const apiKey = process.env.OPENROUTER_API_KEY
    // if (apiKey) {
    //   try {
    //     const OpenRouter = require('openrouter-client')
    //     this.openrouter = new OpenRouter({
    //       apiKey,
    //       baseURL: 'https://openrouter.ai/api/v1',
    //     })
    //   } catch (error) {
    //     console.log('OpenRouter client not available')
    //   }
    // }
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
      // 1. Текстовый поиск в SQLite
      const dbResults = await this.db.searchIndexedFiles(query, options.repositories)

      // 2. Векторный поиск в Qdrant
      const vectorResults = await this.vectorEngine.searchFiles(query, {
        repositories: options.repositories,
        limit: options.maxResults || 20,
        scoreThreshold: options.minScore || 0.7
      })

      // 3. Семантический поиск с OpenAI (если есть) - временно отключен
      let semanticResults: SearchResult[] = []
      // if (this.openrouter && dbResults.length > 0) {
      //   semanticResults = await this.performSemanticSearch(query, dbResults, options)
      // }

      // 4. Объединяем все результаты
      const allResults = [
        ...this.convertVectorResultsToSearchResults(vectorResults),
        ...semanticResults,
        ...this.convertDbResultsToSearchResults(dbResults)
      ]

      // 5. Удаляем дубликаты и сортируем по релевантности
      const uniqueResults = this.deduplicateResults(allResults)

      return uniqueResults
        .filter(result => result.score >= (options.minScore || 0.1))
        .slice(0, options.maxResults || 10)
    } catch (error) {
      console.error('Error searching codebase:', error)
      return []
    }
  }

  async searchDocumentation(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    try {
      // 1. Текстовый поиск в SQLite
      const dbResults = await this.db.searchIndexedPages(query, options.sources)

      // 2. Векторный поиск в Qdrant
      const vectorResults = await this.vectorEngine.searchPages(query, {
        documentation: options.sources,
        limit: options.maxResults || 20,
        scoreThreshold: options.minScore || 0.7
      })

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

  async deepResearch(
    query: string,
    outputFormat?: string,
  ): Promise<{
    summary: string
    analysis: string
    sources: string[]
    recommendations: string[]
  }> {
    // OpenRouter временно отключен
    return {
      summary: 'Deep research temporarily disabled',
      analysis: 'OpenRouter API is temporarily disabled for maintenance.',
      sources: [],
      recommendations: ['Use web search instead', 'Check back later'],
    }

    // try {
    //   if (!this.openrouter) {
    //     throw new Error('OpenRouter API key not configured')
    //   }

    //   // Выполняем многоэтапное исследование
    //   const research = await this.performDeepResearch(query, outputFormat)
    //   return research
    // } catch (error) {
    //   console.error('Error performing deep research:', error)
    //   return {
    //     summary: `Error performing research: ${error}`,
    //     analysis: 'Research could not be completed due to an error.',
    //     sources: [],
    //     recommendations: ['Check API configuration', 'Verify internet connection'],
    //   }
    // }
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
    // Возвращаем пустой массив вместо мок-данных
    return []
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
}

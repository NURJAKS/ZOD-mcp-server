import { describe, it, expect, beforeAll } from 'vitest'
import { SearchEngine } from '../src/core/search'

describe('Deep Search Functionality', () => {
  let searchEngine: SearchEngine

  beforeAll(async () => {
    searchEngine = new SearchEngine()
    await searchEngine.initialize()
  })

  describe('Enhanced Deep Research', () => {
    it('should perform basic deep research without OpenRouter', async () => {
      const result = await searchEngine.deepResearch('React hooks patterns')
      
      expect(result).toBeDefined()
      expect(result.summary).toContain('Enhanced research')
      expect(result.analysis).toContain('Research Methodology')
      expect(result.recommendations.some(rec => rec.includes('nia_deep_research_agent'))).toBe(true)
      expect(result.sources).toBeInstanceOf(Array)
    })

    it('should include code analysis in research', async () => {
      const result = await searchEngine.deepResearch('authentication implementation')
      
      expect(result.analysis).toContain('Research Methodology')
      expect(result.recommendations.some(rec => rec.includes('nia_code_analysis'))).toBe(true)
    })
  })

  describe('Web Search Integration', () => {
    it('should perform web search with enhanced results', async () => {
      const results = await searchEngine.searchWeb('React 18 features', { numResults: 3 })
      
      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)
      
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('title')
        expect(results[0]).toHaveProperty('content')
        expect(results[0]).toHaveProperty('score')
      }
    })
  })

  describe('Code Search Integration', () => {
    it('should perform code search with semantic analysis', async () => {
      const results = await searchEngine.searchCodebase('function authentication', { maxResults: 3 })
      
      expect(results).toBeInstanceOf(Array)
      
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('title')
        expect(results[0]).toHaveProperty('content')
        expect(results[0]).toHaveProperty('score')
        expect(results[0]).toHaveProperty('metadata')
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const result = await searchEngine.deepResearch('')
      
      expect(result.summary).toContain('Enhanced research')
      expect(result.recommendations.some(rec => rec.includes('nia_deep_research_agent'))).toBe(true)
    })

    it('should handle network errors gracefully', async () => {
      // Mock network error by temporarily removing API key
      const originalKey = process.env.OPENROUTER_API_KEY
      delete process.env.OPENROUTER_API_KEY
      
      const result = await searchEngine.deepResearch('test query')
      
      expect(result.summary).toContain('Enhanced research')
      expect(result.recommendations.some(rec => rec.includes('nia_deep_research_agent'))).toBe(true)
      
      // Restore API key
      if (originalKey) {
        process.env.OPENROUTER_API_KEY = originalKey
      }
    })
  })
}) 
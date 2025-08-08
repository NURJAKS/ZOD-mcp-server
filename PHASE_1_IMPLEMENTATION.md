# 🚀 Phase 1 Implementation Guide: Architecture Restructuring

## 📋 Overview

This guide provides step-by-step instructions for implementing Phase 1 of the MCP Server refactoring plan. We'll restructure the codebase using Domain-Driven Design principles while maintaining all existing functionality.

## 🎯 Phase 1 Goals

1. **Break down monolithic files** into focused, maintainable modules
2. **Implement Domain-Driven Design** with clear separation of concerns
3. **Establish proper dependency injection** and loose coupling
4. **Create comprehensive type definitions** for better type safety
5. **Set up foundation for future phases**

## 📁 Step 1: Create New Directory Structure

### 1.1 Create Domain Directories

```bash
# Create the new directory structure
mkdir -p src/domains/{indexing,search,analysis,visualization}/{entities,repositories,services,value-objects}
mkdir -p src/shared/{infrastructure,interfaces,utils,types}
mkdir -p src/application/{use-cases,commands,queries}
mkdir -p src/presentation/{controllers,middlewares,validators}
```

### 1.2 Create Base Interfaces

```typescript
// src/shared/interfaces/base.ts
export interface Entity<T> {
  id: string
  createdAt: Date
  updatedAt: Date
  toJSON(): T
}

export interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
  delete(id: string): Promise<boolean>
  update(id: string, updates: Partial<T>): Promise<T>
}

export interface Service<T, R> {
  execute(input: T): Promise<R>
}
```

## 📁 Step 2: Indexing Domain Refactoring

### 2.1 Create Indexing Entities

```typescript
// src/domains/indexing/entities/repository.entity.ts
import { Entity } from '../../../shared/interfaces/base'

export interface RepositoryData {
  id: string
  owner: string
  repo: string
  branch: string
  status: 'indexing' | 'completed' | 'failed'
  progress: number
  indexedFiles: number
  totalFiles: number
  lastIndexed: Date
  error?: string
  displayName?: string
}

export class RepositoryEntity implements Entity<RepositoryData> {
  constructor(
    public readonly id: string,
    public owner: string,
    public repo: string,
    public branch: string,
    public status: 'indexing' | 'completed' | 'failed',
    public progress: number,
    public indexedFiles: number,
    public totalFiles: number,
    public lastIndexed: Date,
    public error?: string,
    public displayName?: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  toJSON(): RepositoryData {
    return {
      id: this.id,
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      status: this.status,
      progress: this.progress,
      indexedFiles: this.indexedFiles,
      totalFiles: this.totalFiles,
      lastIndexed: this.lastIndexed,
      error: this.error,
      displayName: this.displayName
    }
  }

  updateProgress(progress: number, indexedFiles: number, totalFiles: number): void {
    this.progress = progress
    this.indexedFiles = indexedFiles
    this.totalFiles = totalFiles
    this.updatedAt = new Date()
  }

  markAsCompleted(): void {
    this.status = 'completed'
    this.progress = 100
    this.updatedAt = new Date()
  }

  markAsFailed(error: string): void {
    this.status = 'failed'
    this.error = error
    this.updatedAt = new Date()
  }
}
```

### 2.2 Create Indexing Services

```typescript
// src/domains/indexing/services/repository-indexing.service.ts
import { Service } from '../../../shared/interfaces/base'
import { RepositoryEntity } from '../entities/repository.entity'
import { FileProcessingService } from './file-processing.service'
import { ContentExtractionService } from './content-extraction.service'
import { RepositoryRepository } from '../repositories/repository.repository'

export interface IndexingRequest {
  owner: string
  repo: string
  branch?: string
  maxFiles?: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface IndexingResponse {
  repository: RepositoryEntity
  indexedFiles: number
  totalFiles: number
  duration: number
}

export class RepositoryIndexingService implements Service<IndexingRequest, IndexingResponse> {
  constructor(
    private repositoryRepo: RepositoryRepository,
    private fileProcessor: FileProcessingService,
    private contentExtractor: ContentExtractionService
  ) {}

  async execute(request: IndexingRequest): Promise<IndexingResponse> {
    const startTime = Date.now()
    
    // Create repository entity
    const repository = new RepositoryEntity(
      `${request.owner}/${request.repo}`,
      request.owner,
      request.repo,
      request.branch || 'main',
      'indexing',
      0,
      0,
      0,
      new Date()
    )

    // Save initial state
    await this.repositoryRepo.save(repository)

    try {
      // Process repository
      const result = await this.fileProcessor.processRepository(repository, request)
      
      // Update repository with results
      repository.updateProgress(100, result.indexedFiles, result.totalFiles)
      repository.markAsCompleted()
      
      await this.repositoryRepo.save(repository)

      return {
        repository,
        indexedFiles: result.indexedFiles,
        totalFiles: result.totalFiles,
        duration: Date.now() - startTime
      }
    } catch (error) {
      repository.markAsFailed(error instanceof Error ? error.message : 'Unknown error')
      await this.repositoryRepo.save(repository)
      throw error
    }
  }
}
```

### 2.3 Create File Processing Service

```typescript
// src/domains/indexing/services/file-processing.service.ts
import { RepositoryEntity } from '../entities/repository.entity'
import { FileEntity } from '../entities/file.entity'
import { ContentExtractionService } from './content-extraction.service'
import { FileRepository } from '../repositories/file.repository'

export interface ProcessingOptions {
  maxFiles?: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface ProcessingResult {
  indexedFiles: number
  totalFiles: number
  files: FileEntity[]
}

export class FileProcessingService {
  constructor(
    private contentExtractor: ContentExtractionService,
    private fileRepo: FileRepository
  ) {}

  async processRepository(
    repository: RepositoryEntity,
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    // Implementation details for file processing
    // This will contain the logic from the original indexer.ts
    // but broken down into smaller, focused methods
    
    const files = await this.discoverFiles(repository, options)
    const processedFiles = await this.processFiles(files, repository)
    
    return {
      indexedFiles: processedFiles.length,
      totalFiles: files.length,
      files: processedFiles
    }
  }

  private async discoverFiles(
    repository: RepositoryEntity,
    options: ProcessingOptions
  ): Promise<string[]> {
    // File discovery logic
    return []
  }

  private async processFiles(
    files: string[],
    repository: RepositoryEntity
  ): Promise<FileEntity[]> {
    // File processing logic
    return []
  }
}
```

## 📁 Step 3: Search Domain Refactoring

### 3.1 Create Search Entities

```typescript
// src/domains/search/entities/search-query.entity.ts
export interface SearchQueryData {
  query: string
  filters: SearchFilters
  options: SearchOptions
}

export interface SearchFilters {
  repositories?: string[]
  sources?: string[]
  languages?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
}

export interface SearchOptions {
  maxResults?: number
  minScore?: number
  includeSources?: boolean
}

export class SearchQuery {
  constructor(
    public readonly query: string,
    public readonly filters: SearchFilters = {},
    public readonly options: SearchOptions = {}
  ) {}

  toJSON(): SearchQueryData {
    return {
      query: this.query,
      filters: this.filters,
      options: this.options
    }
  }
}
```

### 3.2 Create Search Services

```typescript
// src/domains/search/services/semantic-search.service.ts
import { Service } from '../../../shared/interfaces/base'
import { SearchQuery } from '../entities/search-query.entity'
import { SearchResult } from '../entities/search-result.entity'
import { VectorSearchService } from './vector-search.service'

export class SemanticSearchService implements Service<SearchQuery, SearchResult[]> {
  constructor(private vectorSearch: VectorSearchService) {}

  async execute(query: SearchQuery): Promise<SearchResult[]> {
    // Semantic search implementation
    const vectorResults = await this.vectorSearch.search(query.query, {
      maxResults: query.options.maxResults,
      minScore: query.options.minScore
    })

    return this.convertToSearchResults(vectorResults)
  }

  private convertToSearchResults(vectorResults: any[]): SearchResult[] {
    // Conversion logic
    return []
  }
}
```

## 📁 Step 4: Analysis Domain Refactoring

### 4.1 Create Analysis Services

```typescript
// src/domains/analysis/services/code-quality-analyzer.service.ts
import { Service } from '../../../shared/interfaces/base'
import { FileEntity } from '../../indexing/entities/file.entity'

export interface QualityAnalysisRequest {
  files: FileEntity[]
}

export interface QualityAnalysisResult {
  complexity: number
  maintainability: number
  testCoverage: number
  codeSmells: string[]
  recommendations: string[]
}

export class CodeQualityAnalyzerService implements Service<QualityAnalysisRequest, QualityAnalysisResult> {
  async execute(request: QualityAnalysisRequest): Promise<QualityAnalysisResult> {
    // Code quality analysis implementation
    // This will contain the logic from project-analyzer.ts
    // but focused specifically on code quality
    
    const complexity = this.calculateComplexity(request.files)
    const maintainability = this.calculateMaintainability(request.files)
    const testCoverage = this.estimateTestCoverage(request.files)
    const codeSmells = this.detectCodeSmells(request.files)
    const recommendations = this.generateRecommendations(request.files)

    return {
      complexity,
      maintainability,
      testCoverage,
      codeSmells,
      recommendations
    }
  }

  private calculateComplexity(files: FileEntity[]): number {
    // Complexity calculation logic
    return 0
  }

  private calculateMaintainability(files: FileEntity[]): number {
    // Maintainability calculation logic
    return 0
  }

  private estimateTestCoverage(files: FileEntity[]): number {
    // Test coverage estimation logic
    return 0
  }

  private detectCodeSmells(files: FileEntity[]): string[] {
    // Code smell detection logic
    return []
  }

  private generateRecommendations(files: FileEntity[]): string[] {
    // Recommendation generation logic
    return []
  }
}
```

## 📁 Step 5: Dependency Injection Setup

### 5.1 Create Service Container

```typescript
// src/shared/infrastructure/service-container.ts
export class ServiceContainer {
  private services = new Map<string, any>()

  register<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  get<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }
    return service
  }

  has(name: string): boolean {
    return this.services.has(name)
  }
}

export const container = new ServiceContainer()
```

### 5.2 Register Services

```typescript
// src/shared/infrastructure/service-registration.ts
import { container } from './service-container'
import { RepositoryIndexingService } from '../../domains/indexing/services/repository-indexing.service'
import { SemanticSearchService } from '../../domains/search/services/semantic-search.service'
import { CodeQualityAnalyzerService } from '../../domains/analysis/services/code-quality-analyzer.service'

export function registerServices(): void {
  // Register indexing services
  container.register('repositoryIndexing', new RepositoryIndexingService(
    container.get('repositoryRepository'),
    container.get('fileProcessing'),
    container.get('contentExtraction')
  ))

  // Register search services
  container.register('semanticSearch', new SemanticSearchService(
    container.get('vectorSearch')
  ))

  // Register analysis services
  container.register('codeQualityAnalyzer', new CodeQualityAnalyzerService())
}
```

## 📁 Step 6: Update Main Entry Point

### 6.1 Refactor index.ts

```typescript
// src/index.ts (updated)
import { registerServices } from './shared/infrastructure/service-registration'
import { container } from './shared/infrastructure/service-container'

// Initialize services
registerServices()

// Update tool registration to use new services
async function registerToolsSafely(mcp: any, debug: boolean = false) {
  const tools = [
    { 
      name: 'RepositoryTools', 
      register: (ctx: any) => import('./domains/indexing/controllers/repository.controller').then(m => m.registerRepositoryTools(ctx))
    },
    { 
      name: 'SearchTools', 
      register: (ctx: any) => import('./domains/search/controllers/search.controller').then(m => m.registerSearchTools(ctx))
    },
    { 
      name: 'AnalysisTools', 
      register: (ctx: any) => import('./domains/analysis/controllers/analysis.controller').then(m => m.registerAnalysisTools(ctx))
    },
    // ... other tools
  ]

  // Registration logic remains the same
}
```

## 📁 Step 7: Migration Strategy

### 7.1 Gradual Migration

1. **Create new structure** alongside existing code
2. **Implement new services** with same interfaces
3. **Update tool registration** to use new services
4. **Test thoroughly** before removing old code
5. **Remove old files** once migration is complete

### 7.2 Testing Strategy

```typescript
// tests/unit/domains/indexing/services/repository-indexing.service.test.ts
import { RepositoryIndexingService } from '../../../../src/domains/indexing/services/repository-indexing.service'

describe('RepositoryIndexingService', () => {
  let service: RepositoryIndexingService

  beforeEach(() => {
    // Setup service with mocked dependencies
  })

  it('should index repository successfully', async () => {
    // Test implementation
  })

  it('should handle indexing errors gracefully', async () => {
    // Test error handling
  })
})
```

## 🎯 Phase 1 Success Criteria

- [ ] All monolithic files broken down into focused modules
- [ ] Domain-driven design implemented
- [ ] Dependency injection working
- [ ] All existing functionality preserved
- [ ] Comprehensive test coverage
- [ ] Type safety improved
- [ ] Performance maintained or improved

## 🚀 Next Steps After Phase 1

1. **Begin Phase 2**: Performance optimization
2. **Implement caching strategies**
3. **Add comprehensive logging**
4. **Enhance error handling**
5. **Add monitoring and metrics**

This implementation guide provides a clear path for restructuring your MCP server while maintaining all existing functionality and improving maintainability. 
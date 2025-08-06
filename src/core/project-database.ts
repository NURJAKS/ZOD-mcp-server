import { QdrantClient } from '@qdrant/js-client-rest'
import neo4j from 'neo4j-driver'
import Redis from 'redis'
import { safeLog } from '../utils'

// Interfaces for data structures
export interface CodeEmbedding {
  id: string
  file_path: string
  content: string
  embedding: number[]
  language: string
  type: 'function' | 'class' | 'module' | 'file'
  metadata: Record<string, any>
}

export interface CodeRelationship {
  source: string
  target: string
  type: 'imports' | 'calls' | 'inherits' | 'depends' | 'uses'
  weight: number
  metadata: Record<string, any>
}

export interface ProjectCache {
  project_id: string
  metadata: ProjectMetadata
  analysis: ProjectAnalysis
  last_updated: Date
  cache_strategy: 'smart' | 'aggressive' | 'minimal'
}

export interface ProjectMetadata {
  id: string
  name: string
  path: string
  language: string
  framework?: string
  dependencies: string[]
  structure: ProjectStructure
  last_analyzed: Date
}

export interface ProjectStructure {
  files: FileInfo[]
  directories: DirectoryInfo[]
  dependencies: DependencyInfo[]
  technologies: TechnologyInfo[]
}

export interface FileInfo {
  path: string
  name: string
  size: number
  language: string
  type: 'code' | 'config' | 'documentation' | 'other'
  last_modified: Date
}

export interface DirectoryInfo {
  path: string
  name: string
  depth: number
  file_count: number
  subdirectories: string[]
}

export interface DependencyInfo {
  name: string
  version: string
  type: 'production' | 'development' | 'peer'
  source: string
}

export interface TechnologyInfo {
  name: string
  category: 'framework' | 'library' | 'tool' | 'language'
  version?: string
  confidence: number
}

export interface ProjectAnalysis {
  quality: QualityMetrics
  performance: PerformanceMetrics
  security: SecurityMetrics
  maintainability: MaintainabilityMetrics
  architecture: ArchitectureAnalysis
  patterns: CodePattern[]
  insights: string[]
  recommendations: string[]
}

export interface QualityMetrics {
  cyclomatic_complexity: number
  code_duplication: number
  test_coverage: number
  documentation_coverage: number
  code_smells: number
  technical_debt: number
}

export interface PerformanceMetrics {
  bundle_size: number
  load_time: number
  memory_usage: number
  cpu_usage: number
  bottlenecks: string[]
}

export interface SecurityMetrics {
  vulnerabilities: number
  security_score: number
  risk_level: 'low' | 'medium' | 'high'
  issues: string[]
}

export interface MaintainabilityMetrics {
  maintainability_index: number
  technical_debt_ratio: number
  code_churn: number
  complexity: number
}

export interface ArchitectureAnalysis {
  pattern: string
  layers: string[]
  components: string[]
  dependencies: CodeRelationship[]
  coupling: number
  cohesion: number
}

export interface CodePattern {
  name: string
  type: 'design_pattern' | 'anti_pattern' | 'architectural_pattern'
  confidence: number
  locations: string[]
  description: string
}

export class ProjectDatabase {
  private qdrant: QdrantClient | null = null
  private neo4j: neo4j.Driver | null = null
  private redis: Redis.RedisClientType | null = null
  private isInitialized = false

  constructor() {
    // Initialize connections based on environment
    this.initializeConnections()
  }

  private async initializeConnections() {
    try {
      // Initialize Qdrant for vector embeddings
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
      this.qdrant = new QdrantClient({ url: qdrantUrl })
      
      // Test Qdrant connection
      await this.qdrant.getCollections()
      safeLog('✅ Qdrant connection established')
    } catch (error) {
      safeLog('⚠️ Qdrant not available, embeddings will be disabled', 'warn')
    }

    try {
      // Initialize Neo4j for graph relationships
      const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687'
      const neo4jUser = process.env.NEO4J_USER || 'neo4j'
      const neo4jPassword = process.env.NEO4J_PASSWORD || 'password'
      
      this.neo4j = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword))
      
      // Test Neo4j connection
      const session = this.neo4j.session()
      await session.run('RETURN 1')
      await session.close()
      safeLog('✅ Neo4j connection established')
    } catch (error) {
      safeLog('⚠️ Neo4j not available, graph analysis will be disabled', 'warn')
    }

    try {
      // Initialize Redis for caching
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      this.redis = Redis.createClient({ url: redisUrl })
      
      // Test Redis connection
      await this.redis.connect()
      await this.redis.ping()
      safeLog('✅ Redis connection established')
    } catch (error) {
      safeLog('⚠️ Redis not available, caching will be disabled', 'warn')
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Create collections and indexes
      await this.createCollections()
      await this.createIndexes()
      
      this.isInitialized = true
      safeLog('✅ Project database initialized successfully')
    } catch (error) {
      safeLog(`❌ Failed to initialize project database: ${error}`, 'error')
      throw error
    }
  }

  private async createCollections() {
    if (!this.qdrant) return

    try {
      // Create code embeddings collection
      await this.qdrant.createCollection('code_embeddings', {
        vectors: {
          size: 1536, // OpenAI embedding size
          distance: 'Cosine'
        }
      })
      safeLog('✅ Created code_embeddings collection')
    } catch (error) {
      // Collection might already exist
      safeLog('ℹ️ Code embeddings collection already exists')
    }
  }

  private async createIndexes() {
    if (!this.neo4j) return

    try {
      const session = this.neo4j.session()
      
      // Create indexes for better performance
      await session.run('CREATE INDEX code_file_index IF NOT EXISTS FOR (f:CodeFile) ON (f.path)')
      await session.run('CREATE INDEX code_function_index IF NOT EXISTS FOR (f:CodeFunction) ON (f.name)')
      await session.run('CREATE INDEX code_class_index IF NOT EXISTS FOR (c:CodeClass) ON (c.name)')
      
      await session.close()
      safeLog('✅ Created Neo4j indexes')
    } catch (error) {
      safeLog('⚠️ Failed to create Neo4j indexes', 'warn')
    }
  }

  // Vector Database Operations (Qdrant)
  async storeEmbeddings(embeddings: CodeEmbedding[]): Promise<void> {
    if (!this.qdrant) {
      throw new Error('Qdrant not available')
    }

    const points = embeddings.map(embedding => ({
      id: embedding.id,
      vector: embedding.embedding,
      payload: {
        file_path: embedding.file_path,
        content: embedding.content,
        language: embedding.language,
        type: embedding.type,
        metadata: embedding.metadata
      }
    }))

    await this.qdrant.upsert('code_embeddings', {
      points: points
    })
  }

  async searchEmbeddings(query: string, limit: number = 10): Promise<CodeEmbedding[]> {
    if (!this.qdrant) {
      throw new Error('Qdrant not available')
    }

    // For now, return empty results - embeddings will be implemented later
    return []
  }

  // Graph Database Operations (Neo4j)
  async storeRelationships(relationships: CodeRelationship[]): Promise<void> {
    if (!this.neo4j) {
      throw new Error('Neo4j not available')
    }

    const session = this.neo4j.session()
    
    try {
      for (const rel of relationships) {
        await session.run(`
          MERGE (source:CodeEntity {id: $source})
          MERGE (target:CodeEntity {id: $target})
          MERGE (source)-[r:${rel.type.toUpperCase()} {weight: $weight}]->(target)
          SET r.metadata = $metadata
        `, {
          source: rel.source,
          target: rel.target,
          weight: rel.weight,
          metadata: rel.metadata
        })
      }
    } finally {
      await session.close()
    }
  }

  async getRelationships(source?: string, type?: string): Promise<CodeRelationship[]> {
    if (!this.neo4j) {
      throw new Error('Neo4j not available')
    }

    const session = this.neo4j.session()
    
    try {
      let query = 'MATCH (source:CodeEntity)-[r]->(target:CodeEntity)'
      const params: any = {}
      
      if (source) {
        query += ' WHERE source.id = $source'
        params.source = source
      }
      
      if (type) {
        query += source ? ' AND' : ' WHERE'
        query += ` type(r) = '${type.toUpperCase()}'`
      }
      
      query += ' RETURN source.id, target.id, type(r), r.weight, r.metadata'
      
      const result = await session.run(query, params)
      
      return result.records.map(record => ({
        source: record.get('source.id'),
        target: record.get('target.id'),
        type: record.get('type(r)').toLowerCase(),
        weight: record.get('r.weight'),
        metadata: record.get('r.metadata')
      }))
    } finally {
      await session.close()
    }
  }

  // Cache Operations (Redis)
  async cacheProjectData(projectId: string, data: any, ttl: number = 3600): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not available')
    }

    const key = `project:${projectId}`
    await this.redis.setEx(key, ttl, JSON.stringify(data))
  }

  async getCachedProjectData(projectId: string): Promise<any | null> {
    if (!this.redis) {
      throw new Error('Redis not available')
    }

    const key = `project:${projectId}`
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not available')
    }

    const key = `project:${projectId}`
    await this.redis.del(key)
  }

  // Utility methods
  async isAvailable(): Promise<{
    qdrant: boolean
    neo4j: boolean
    redis: boolean
  }> {
    return {
      qdrant: this.qdrant !== null,
      neo4j: this.neo4j !== null,
      redis: this.redis !== null
    }
  }

  async close(): Promise<void> {
    if (this.neo4j) {
      await this.neo4j.close()
    }
    if (this.redis) {
      await this.redis.quit()
    }
  }
} 
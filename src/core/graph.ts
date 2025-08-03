import neo4j, { Driver } from 'neo4j-driver'
import { safeLog } from '../utils'

export interface CodeEntity {
  id: string
  type: 'file' | 'function' | 'class' | 'module' | 'repository'
  name: string
  path?: string
  language?: string
  repository?: string
  properties?: Record<string, any>
}

export interface CodeRelationship {
  from: string
  to: string
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'depends_on' | 'contains'
  properties?: Record<string, any>
}

export class GraphService {
  private driver: Driver | null = null
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687'
      const username = process.env.NEO4J_USERNAME || 'neo4j'
      const password = process.env.NEO4J_PASSWORD

      if (!password) {
        safeLog('⚠️ NEO4J_PASSWORD not configured, graph features disabled', 'warn')
        return
      }

      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
      
      // Test connection
      const session = this.driver.session()
      await session.run('RETURN 1')
      await session.close()

      this.isInitialized = true
      safeLog('✅ Neo4j graph database connected')
    } catch (error) {
      safeLog(`⚠️ Neo4j connection failed: ${error}`, 'warn')
      this.driver = null
    }
  }

  public get isReady(): boolean {
    return this.isInitialized && this.driver !== null
  }

  async createEntity(entity: CodeEntity): Promise<void> {
    if (!this.isReady) return

    const session = this.driver!.session()
    try {
      await session.run(`
        MERGE (e:CodeEntity {id: $id})
        SET e.type = $type,
            e.name = $name,
            e.path = $path,
            e.language = $language,
            e.repository = $repository,
            e.properties = $properties
      `, {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        path: entity.path,
        language: entity.language,
        repository: entity.repository,
        properties: entity.properties || {},
      })
    } finally {
      await session.close()
    }
  }

  async createRelationship(relationship: CodeRelationship): Promise<void> {
    if (!this.isReady) return

    const session = this.driver!.session()
    try {
      await session.run(`
        MATCH (from:CodeEntity {id: $fromId})
        MATCH (to:CodeEntity {id: $toId})
        MERGE (from)-[r:${relationship.type.toUpperCase()}]->(to)
        SET r.properties = $properties
      `, {
        fromId: relationship.from,
        toId: relationship.to,
        properties: relationship.properties || {},
      })
    } finally {
      await session.close()
    }
  }

  async getStats(): Promise<{
    nodes: number
    relationships: number
    repositories: number
    connected: boolean
  }> {
    if (!this.isReady) {
      return { nodes: 0, relationships: 0, repositories: 0, connected: false }
    }

    try {
      const session = this.driver!.session()
      const nodeResult = await session.run('MATCH (n:CodeEntity) RETURN count(n) as count')
      const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count')
      const repoResult = await session.run('MATCH (n:CodeEntity) RETURN count(DISTINCT n.repository) as count')
      await session.close()

      return {
        nodes: nodeResult.records[0]?.get('count') || 0,
        relationships: relResult.records[0]?.get('count') || 0,
        repositories: repoResult.records[0]?.get('count') || 0,
        connected: true,
      }
    } catch (error) {
      safeLog(`Graph stats error: ${error}`, 'error')
      return { nodes: 0, relationships: 0, repositories: 0, connected: false }
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close()
      this.isInitialized = false
    }
  }
}

// Global graph instance
export const graphService = new GraphService() 
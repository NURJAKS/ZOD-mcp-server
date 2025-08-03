import type { McpToolContext } from '../types'
import { z } from 'zod'
import { cacheService } from '../core/cache'
import { graphService } from '../core/graph'
import { storageService } from '../core/storage'
import { safeLog } from '../utils'

export function registerStorageTools({ mcp }: McpToolContext): void {
  // get_storage_stats - Get comprehensive storage statistics
  mcp.tool(
    'get_storage_stats',
    'Get comprehensive statistics for all storage systems (cache, graph, vector, object storage)',
    {},
    async () => {
      try {
        const [cacheStats, graphStats, storageStats] = await Promise.all([
          cacheService.getStats(),
          graphService.getStats(),
          storageService.getStats(),
        ])

        const statsText = `📊 **Storage Statistics**\n\n`
          + `🔴 **Redis Cache:**\n`
          + `• Connected: ${cacheStats.connected ? '✅' : '❌'}\n`
          + `• Keys: ${cacheStats.keys}\n`
          + `• Memory: ${cacheStats.memory}\n\n`
          + `🟢 **Neo4j Graph:**\n`
          + `• Connected: ${graphStats.connected ? '✅' : '❌'}\n`
          + `• Nodes: ${graphStats.nodes}\n`
          + `• Relationships: ${graphStats.relationships}\n`
          + `• Repositories: ${graphStats.repositories}\n\n`
          + `🔵 **MinIO Storage:**\n`
          + `• Connected: ${storageStats.connected ? '✅' : '❌'}\n`
          + `• Files: ${storageStats.files}\n`
          + `• Total Size: ${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB\n`
          + `• Bucket: ${storageStats.bucket}\n\n`
          + `💡 **Usage Tips:**\n`
          + `• Use cache for session data and search results\n`
          + `• Use graph for code relationships and dependencies\n`
          + `• Use object storage for large documents and files`

        return {
          content: [{
            type: 'text',
            text: statsText,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error getting storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
} 
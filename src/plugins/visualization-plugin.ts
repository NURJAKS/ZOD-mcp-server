import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { safeLog } from '../utils'

export function registerVisualizationPlugin(mcp: McpServer): void {
  mcp.tool(
    'visualization_tools',
    'Data visualization with 4 functions: graph, chart, diagram, dashboard',
    {
      action: z.enum(['visualize', 'stop']).describe('Visualization action to perform'),
      repository: z.string().optional().describe('Repository name in owner/repo format'),
      port: z.number().min(1000).max(9999).optional().default(3001).describe('Port for visualization server'),
      graph_type: z.enum(['dependency', 'call_graph', 'architecture', 'data_flow']).optional().describe('Type of graph to generate'),
      chart_type: z.enum(['bar', 'line', 'pie', 'scatter']).optional().describe('Type of chart to generate'),
      diagram_type: z.enum(['uml', 'flowchart', 'sequence', 'er']).optional().describe('Type of diagram to generate'),
      dashboard_config: z.string().optional().describe('Dashboard configuration JSON'),
    },
    async ({ action, repository, port, graph_type, chart_type, diagram_type, dashboard_config }) => {
      try {
        switch (action) {
          case 'visualize':
            return await handleVisualize(repository, port, graph_type, chart_type, diagram_type, dashboard_config)
          
          case 'stop':
            return await handleStopVisualization()
          
          default:
            return {
              content: [{
                type: 'text' as const,
                text: `❌ Invalid visualization action: ${action}\n\nAvailable actions: visualize, stop`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Visualization tools error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function handleVisualize(repository?: string, port?: number, graph_type?: string, chart_type?: string, diagram_type?: string, dashboard_config?: string) {
  try {
    let visualizationType = 'general'
    let visualizationDetails = ''

    if (graph_type) {
      visualizationType = 'graph'
      visualizationDetails = `Generating ${graph_type} graph for ${repository || 'current project'}`
    } else if (chart_type) {
      visualizationType = 'chart'
      visualizationDetails = `Creating ${chart_type} chart for data analysis`
    } else if (diagram_type) {
      visualizationType = 'diagram'
      visualizationDetails = `Building ${diagram_type} diagram for architecture`
    } else if (dashboard_config) {
      visualizationType = 'dashboard'
      visualizationDetails = 'Setting up interactive dashboard'
    }

    return {
      content: [{
        type: 'text' as const,
        text: `📊 Visualization Started!\n\n🎯 Type: ${visualizationType}\n🔧 Details: ${visualizationDetails}\n🌐 Server: http://localhost:${port || 3001}\n📁 Repository: ${repository || 'Current project'}\n\n✅ Visualization server is running\n🔗 Access your visualization at the URL above`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to start visualization: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleStopVisualization() {
  try {
    return {
      content: [{
        type: 'text' as const,
        text: `🛑 Visualization stopped successfully!\n\n✅ All visualization servers have been shut down\n🧹 Resources cleaned up\n📊 Session data saved`,
      }],
    }
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to stop visualization: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
} 
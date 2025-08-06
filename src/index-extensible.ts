import { createServer } from './server'
import { PluginManager, ServiceContainer } from './core/plugin-manager'
import { ToolRegistry } from './core/base-tool'
import { configManager } from './core/config-manager'
import { RepositoryTool } from './tools/repository-v2'

// Import existing tools (you would gradually migrate these)
import { registerRepositoryTools } from './tools/repository'
import { registerDocumentationTools } from './tools/documentation'
import { registerWebSearchTools } from './tools/web-search'
import { registerProjectInitTools } from './tools/project-init'
import { registerDeepSearchTools } from './tools/deep-search'
import { registerFleetTools } from './tools/fleet'
import { registerSmartAIAnalyzer } from './tools/smart-ai-analyzer'

// Enhanced extensible server setup
export class ExtensibleMCPServer {
  private pluginManager: PluginManager
  private toolRegistry: ToolRegistry
  private serviceContainer: ServiceContainer
  private mcp: any

  constructor() {
    this.pluginManager = new PluginManager()
    this.toolRegistry = new ToolRegistry()
    this.serviceContainer = new ServiceContainer()
  }

  async initialize(): Promise<void> {
    // Load configuration
    await configManager.loadConfig()
    
    // Create MCP server
    this.mcp = createServer({ 
      name: 'zod-mcp-server', 
      version: '2.0.0' 
    })

    // Register core services
    this.registerCoreServices()

    // Register tools based on configuration
    await this.registerTools()

    // Initialize plugins
    await this.initializePlugins()

    console.log('🚀 Extensible MCP Server initialized successfully')
  }

  private registerCoreServices(): void {
    // Register shared services that tools can depend on
    this.serviceContainer.register('config', configManager)
    this.serviceContainer.register('pluginManager', this.pluginManager)
    this.serviceContainer.register('toolRegistry', this.toolRegistry)
  }

  private async registerTools(): Promise<void> {
    const config = configManager.get('features')

    // Register new extensible tools
    if (config.enableRepository) {
      const repositoryTool = new RepositoryTool()
      this.toolRegistry.register(repositoryTool)
      this.toolRegistry.registerWithMCP(repositoryTool, this.mcp)
    }

    // Register legacy tools (gradual migration)
    const legacyTools = [
      { name: 'DocumentationTools', register: registerDocumentationTools, enabled: true },
      { name: 'WebSearchTools', register: registerWebSearchTools, enabled: true },
      { name: 'ProjectInitTools', register: registerProjectInitTools, enabled: true },
      { name: 'DeepSearchTools', register: registerDeepSearchTools, enabled: config.enableDeepSearch },
      { name: 'FleetTools', register: registerFleetTools, enabled: config.enableFleet },
      { name: 'SmartAIAnalyzer', register: registerSmartAIAnalyzer, enabled: config.enableSmartAI },
    ]

    for (const tool of legacyTools) {
      if (tool.enabled) {
        try {
          await tool.register({ mcp: this.mcp })
          console.log(`✅ Registered legacy tool: ${tool.name}`)
        } catch (error) {
          console.error(`❌ Failed to register legacy tool ${tool.name}:`, error)
        }
      }
    }
  }

  private async initializePlugins(): Promise<void> {
    // Example: Register a plugin
    const examplePlugin = {
      name: 'example-plugin',
      version: '1.0.0',
      description: 'Example plugin for demonstration',
      dependencies: ['repository_tools'],
      register: async (context) => {
        console.log('🔌 Example plugin registered')
      }
    }

    this.pluginManager.registerPlugin(examplePlugin)

    // Initialize all plugins
    await this.pluginManager.initializePlugins({
      mcp: this.mcp,
      config: configManager.get('plugins'),
      services: this.serviceContainer
    })
  }

  getMCP(): any {
    return this.mcp
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down extensible MCP server...')
    // Cleanup resources
  }
}

// Usage example
async function main() {
  const server = new ExtensibleMCPServer()
  await server.initialize()
  
  // Handle shutdown gracefully
  process.on('SIGTERM', () => server.shutdown())
  process.on('SIGINT', () => server.shutdown())
  
  return server.getMCP()
}

// Export for use in other modules
export { ExtensibleMCPServer }
export default main 
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

// Base interface for all tools
export interface BaseTool {
  name: string
  description: string
  schema: z.ZodSchema
  execute: (params: any, context: ToolContext) => Promise<ToolResult>
}

// Tool execution context
export interface ToolContext {
  mcp: McpServer
  services: ServiceContainer
  config: ToolConfig
}

// Tool configuration
export interface ToolConfig {
  debug?: boolean
  timeout?: number
  retries?: number
}

// Tool execution result
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'error'
    text?: string
    url?: string
  }>
  metadata?: Record<string, any>
}

// Abstract base class for all tools
export abstract class AbstractTool implements BaseTool {
  abstract name: string
  abstract description: string
  abstract schema: z.ZodSchema

  // Template method pattern
  async execute(params: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Validate parameters
      const validatedParams = this.schema.parse(params)
      
      // Pre-execution hook
      await this.beforeExecute(validatedParams, context)
      
      // Execute the tool
      const result = await this.executeTool(validatedParams, context)
      
      // Post-execution hook
      await this.afterExecute(result, context)
      
      return result
    } catch (error) {
      return this.handleError(error)
    }
  }

  // Abstract method that subclasses must implement
  protected abstract executeTool(params: any, context: ToolContext): Promise<ToolResult>

  // Optional hooks for extensibility
  protected async beforeExecute(params: any, context: ToolContext): Promise<void> {
    // Override in subclasses if needed
  }

  protected async afterExecute(result: ToolResult, context: ToolContext): Promise<void> {
    // Override in subclasses if needed
  }

  protected handleError(error: any): ToolResult {
    return {
      content: [{
        type: 'error',
        text: `❌ ${this.name} error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

// Service container for dependency injection
export class ServiceContainer {
  private services = new Map<string, any>()

  register<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  get<T>(name: string): T | undefined {
    return this.services.get(name)
  }

  has(name: string): boolean {
    return this.services.has(name)
  }
}

// Tool registry for managing all tools
export class ToolRegistry {
  private tools = new Map<string, BaseTool>()

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name)
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values())
  }

  // Register tool with MCP server
  registerWithMCP(tool: BaseTool, mcp: McpServer): void {
    mcp.tool(
      tool.name,
      tool.description,
      tool.schema,
      async (params) => {
        const context: ToolContext = {
          mcp,
          services: new ServiceContainer(), // You might want to pass a shared instance
          config: { debug: false }
        }
        return await tool.execute(params, context)
      }
    )
  }
} 
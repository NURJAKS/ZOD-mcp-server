import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { EnvManager } from './core/env-manager'

export interface McpToolContext {
  mcp: McpServer
  envManager: EnvManager
}

// Define the options type
export interface McpServerOptions {
  name: string
  version: string
}

export type Tools = (context: McpToolContext) => void

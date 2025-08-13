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

/**
 * Configuration options for project indexing
 * @interface IndexingOptions
 * @description Defines parameters for controlling the indexing process
 */
export interface IndexingOptions {
  /** Enable vector search capabilities */
  enableVectorSearch?: boolean
  /** Maximum file size to process (in bytes) */
  maxFileSize?: number
  /** File extensions to include */
  includeExtensions?: string[]
  /** File extensions to exclude */
  excludeExtensions?: string[]
  /** Enable verbose logging */
  verbose?: boolean
  /** Force re-indexing of existing files */
  forceReindex?: boolean
  /** Maximum depth for directory traversal */
  maxDepth?: number
  /** Enable parallel processing */
  parallel?: boolean
  /** Number of worker threads for parallel processing */
  workerThreads?: number
  /** Branch to index (for git repositories) */
  branch?: string
  /** Maximum number of files to process */
  maxFiles?: number
  /** Maximum file size in bytes */
  maxFileSizeBytes?: number
  /** File patterns to include */
  includePatterns?: string[]
  /** File patterns to exclude */
  excludePatterns?: string[]
}

/**
 * Project configuration interface
 */
export interface ProjectConfig {
  /** Project root directory */
  root: string
  /** Project name */
  name: string
  /** Project version */
  version?: string
  /** Indexing options */
  indexing?: IndexingOptions
  /** Vector search configuration */
  vectorSearch?: {
    enabled: boolean
    model?: string
    dimensions?: number
  }
}

/**
 * File information interface
 */
export interface FileInfo {
  /** File path relative to project root */
  path: string
  /** File size in bytes */
  size: number
  /** File extension */
  extension?: string
  /** File language (detected) */
  language?: string
  /** File content hash */
  hash?: string
  /** Last modified timestamp */
  modified?: Date
  /** Whether file is binary */
  isBinary?: boolean
  /** Number of lines in the file */
  lines?: number
  /** File content */
  content?: string
}

/**
 * Code embedding interface
 */
export interface CodeEmbedding {
  /** File path */
  path: string
  /** Content hash */
  hash: string
  /** Vector embedding */
  embedding: number[]
  /** Language */
  language?: string
  /** Metadata */
  metadata?: Record<string, any>
}

/**
 * Indexing result interface
 */
export interface IndexingResult {
  /** Total files processed */
  totalFiles: number
  /** Successfully indexed files */
  indexedFiles: number
  /** Failed files */
  failedFiles: number
  /** Vector search enabled */
  vectorSearchEnabled: boolean
  /** Processing duration in milliseconds */
  duration: number
  /** Error messages */
  errors: string[]
  /** Warning messages */
  warnings: string[]
  /** Indexing statistics */
  stats: {
    byLanguage: Record<string, number>
    bySize: Record<string, number>
    totalSize: number
  }
}

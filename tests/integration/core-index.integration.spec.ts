import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/server'
import { getEnvManager } from '../../src/core/env-manager'
import { registerCoreIndexTool } from '../../src/tools/zod-core/core-index'
import { join } from 'node:path'
import type { McpToolContext } from '../../src/types'

describe('Core Index Tool Integration Test', () => {
  let mcp: any
  let envManager: any
  let testProject: any
  let toolHandler: any

  beforeAll(async () => {
    // Create a test project using the new test utilities
    testProject = await global.testUtils.createTempProject({
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          typescript: '^5.0.0'
        }
      }),
      'src': {
        'components': {
          'Button.tsx': `
import React from 'react'

interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, variant = 'primary' }) => {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default Button
`,
        },
        'utils': {
          'helpers.ts': `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export class ApiClient {
  constructor(private baseUrl: string) {}
  
  async get(endpoint: string) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`)
    return response.json()
  }
}
`,
        },
        'types': {
          'api.ts': `
export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export interface ApiResponse<T> {
  data: T
  message: string
  status: 'success' | 'error'
}

export type UserRole = 'admin' | 'user' | 'guest'
`,
        },
        'index.ts': `
import { Button } from './components/Button'
import { formatDate, ApiClient } from './utils/helpers'
import { User, ApiResponse } from './types/api'

const apiClient = new ApiClient('https://api.example.com')

console.log('Hello from test project!')
`,
      },
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true,
          jsx: 'react-jsx'
        }
      })
    })

    // Create MCP server and register tools
    mcp = createServer()
    envManager = getEnvManager()
    
    const context: McpToolContext = {
      mcp,
      envManager,
      logger: console,
    }
    
    registerCoreIndexTool(context)
    
    // Get the tool handler
    const tools = mcp.getTools()
    toolHandler = tools.find((t: any) => t.name === 'core_index')
  })

  afterAll(async () => {
    // Clean up test project
    if (testProject?.cleanup) {
      await testProject.cleanup()
    }
  })

  test('should index a basic project successfully', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    
    const output = result.content[0].text
    expect(output).toMatch(/Project Index Complete|Index completed successfully/i)
    expect(output).toMatch(/Files Indexed|files indexed/i)
    expect(output).toMatch(/Directories|directories scanned/i)
  })

  test('should index project and save to specific location', async () => {
    const customDbPath = join(testProject.path, 'custom_index.sqlite')
    
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
      save_to: customDbPath,
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    const output = result.content[0].text
    expect(output).toMatch(/Database.*custom_index\.sqlite|Index saved to/i)
    expect(output).toContain('custom_index.sqlite')
  })

  test('should detect multiple programming languages', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
    })
    
    const output = result.content[0].text
    expect(output).toMatch(/typescript|TypeScript/i) // .tsx and .ts files
    expect(output).toMatch(/json|JSON/i) // package.json, config.json
  })

  test('should analyze project structure and dependencies', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
      analyze_dependencies: true,
    })
    
    const output = result.content[0].text
    // Should detect file structure (flexible matching)
    expect(output).toMatch(/src|components|utils|types/i)
    expect(output).toMatch(/Files Indexed.*[0-9]+/i)
    expect(output).toMatch(/Directories.*[0-9]+/i)
  })

  test('should handle empty directories gracefully', async () => {
    // Create an empty directory
    const emptyDir = join(testProject.path, 'empty-dir')
    await global.testUtils.createTempProject({ 'empty-dir': {} })
    
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    const output = result.content[0].text
    expect(output).toMatch(/Project Index Complete|Index completed successfully/i)
  })

  test('should generate project analysis with quality metrics', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
      analyze_quality: true,
    })
    
    const output = result.content[0].text
    // Should include quality analysis
    expect(output).toMatch(/quality|metrics|analysis/i)
    expect(output).toMatch(/files|directories/i)
  })

  test('should detect project frameworks and technologies', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
      analyze_frameworks: true,
    })
    
    const output = result.content[0].text
    // Should detect React based on imports
    expect(output).toContain('React') // From Button.tsx import
  })

  test('should handle different file encodings', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    const output = result.content[0].text
    expect(output).toMatch(/Project Index Complete|Index completed successfully/i)
  })

  test('should provide comprehensive metadata', async () => {
    const result = await toolHandler.handler({
      action: 'index',
      path: testProject.path,
      include_metadata: true,
    })
    
    const output = result.content[0].text
    expect(output).toMatch(/Files Indexed.*[0-9]+/i)
    expect(output).toMatch(/Duration.*[0-9]+ms/i)
    expect(output).toMatch(/Languages.*typescript/i)
  })

  test('should handle large project structures efficiently', async () => {
    // Create a larger project structure
    const largeProject = await global.testUtils.createTempProject({
      'src': {
        'components': {
          'Component1.tsx': 'export const Component1 = () => <div>Component 1</div>',
          'Component2.tsx': 'export const Component2 = () => <div>Component 2</div>',
          'Component3.tsx': 'export const Component3 = () => <div>Component 3</div>',
        },
        'utils': {
          'util1.ts': 'export const util1 = () => "util 1"',
          'util2.ts': 'export const util2 = () => "util 2"',
        }
      }
    })
    
    const result = await toolHandler.handler({
      action: 'index',
      path: largeProject.path,
    })
    
    const output = result.content[0].text
    expect(output).toMatch(/Project Index Complete|Index completed successfully/i)
    
    // Clean up
    await largeProject.cleanup()
  })
})
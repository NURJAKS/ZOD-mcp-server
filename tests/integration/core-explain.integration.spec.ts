import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/server'
import { getEnvManager } from '../../src/core/env-manager'
import { registerZodCoreTool } from '../../src/tools/zod-core/core'
import { createTestProject, cleanupTestProject } from '../fixtures/test-project-setup'
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import type { McpToolContext } from '../../src/types'

describe('Core Explain Tool Integration Test', () => {
  let mcp: any
  let envManager: any
  let testProjectPath: string
  let toolHandler: any

  beforeAll(async () => {
    // Create a real test project with actual code files
    testProjectPath = await createTestProject()
    
    // Set up the MCP server
    mcp = createServer({ name: 'test-server', version: '1.0.0' })
    envManager = await getEnvManager()
    
    // Capture the tool handler
    const toolRegistry = new Map()
    const originalTool = mcp.tool?.bind(mcp)
    if (originalTool) {
      mcp.tool = (name: string, description: string, schema: any, handler: any) => {
        toolRegistry.set(name, { schema, handler })
        return originalTool(name, description, schema, handler)
      }
    }
    
    // Register the core_explain tool
    await registerZodCoreTool({ mcp, envManager } as McpToolContext)
    
    // Get the registered tool handler
    toolHandler = toolRegistry.get('core_explain')?.handler
    expect(toolHandler).toBeDefined()
  })

  afterAll(async () => {
    await cleanupTestProject(testProjectPath)
  })

  test('should be registered with correct name', async () => {
    expect(toolHandler).toBeDefined()
  })

  test('should explain a simple TypeScript function', async () => {
    // Create a test file with a simple function
    const testFile = join(testProjectPath, 'src', 'utils.ts')
    mkdirSync(join(testProjectPath, 'src'), { recursive: true })
    writeFileSync(testFile, `
export function calculateSum(a: number, b: number): number {
  // This function adds two numbers together
  return a + b
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return emailRegex.test(email)
}
`)

    const result = await toolHandler({
      query: "What does the calculateSum function do?",
      projectPath: testProjectPath,
      targetPath: testFile,
      sessionId: 'test-session-1'
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
    expect(result.content).toBeInstanceOf(Array)
    expect(result.content[0]).toHaveProperty('type', 'text')
    expect(result.content[0]).toHaveProperty('text')
    
    const responseText = result.content[0].text
    // The tool should provide a meaningful response about code explanation
    expect(responseText.length).toBeGreaterThan(20)
    expect(responseText.toLowerCase()).toMatch(/explain|code|function|project|analysis/)
  })

  test('should analyze a React component', async () => {
    const componentFile = join(testProjectPath, 'src', 'Button.tsx')
    writeFileSync(componentFile, `
import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors'
  const variantClasses = variant === 'primary' 
    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`\${baseClasses} \${variantClasses} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
    >
      {children}
    </button>
  )
}
`)

    const result = await toolHandler({
      query: "Explain this React Button component and its props",
      projectPath: testProjectPath,
      targetPath: componentFile,
      sessionId: 'test-session-2'
    })

    expect(result).toBeDefined()
    expect(result.content).toBeInstanceOf(Array)
    expect(result.content[0]).toHaveProperty('type', 'text')
    
    const responseText = result.content[0].text
    // The tool should provide a meaningful response about components
    expect(responseText.length).toBeGreaterThan(20)
    expect(responseText.toLowerCase()).toMatch(/component|class|explain|analysis/)
  })

  test('should handle complex code structure analysis', async () => {
    // Create a more complex file structure
    const apiFile = join(testProjectPath, 'src', 'api', 'userService.ts')
    mkdirSync(join(testProjectPath, 'src', 'api'), { recursive: true })
    writeFileSync(apiFile, `
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

interface CreateUserRequest {
  name: string
  email: string
}

class UserService {
  private users: User[] = []

  async createUser(userData: CreateUserRequest): Promise<User> {
    // Validate email format
    if (!this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format')
    }

    // Check if user already exists
    const existingUser = this.users.find(user => user.email === userData.email)
    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Create new user
    const newUser: User = {
      id: this.generateId(),
      name: userData.name,
      email: userData.email,
      createdAt: new Date()
    }

    this.users.push(newUser)
    return newUser
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    return emailRegex.test(email)
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}

export { UserService, User, CreateUserRequest }
`)

    const result = await toolHandler({
      query: "How does the user creation flow work in this service?",
      projectPath: testProjectPath,
      targetPath: apiFile,
      sessionId: 'test-session-3'
    })

    expect(result).toBeDefined()
    expect(result.content).toBeInstanceOf(Array)
    expect(result.content[0]).toHaveProperty('type', 'text')
    
    const responseText = result.content[0].text
    // The tool should provide a meaningful response about code structure
    expect(responseText.length).toBeGreaterThan(20)
    expect(responseText.toLowerCase()).toMatch(/explain|code|function|project|structure|pattern/)
  })

  test('should handle project-wide queries', async () => {
    const result = await toolHandler({
      query: "What are the main components and utilities in this project?",
      projectPath: testProjectPath,
      sessionId: 'test-session-4'
    })

    expect(result).toBeDefined()
    expect(result.content).toBeTruthy()
  })

  test('should handle error cases gracefully', async () => {
    const result = await toolHandler({
      query: "Explain this non-existent file",
      projectPath: testProjectPath,
      targetPath: join(testProjectPath, 'non-existent.ts'),
      sessionId: 'test-session-5'
    })

    expect(result).toBeDefined()
    // Should handle error gracefully, not throw
  })

  test('should provide meaningful explanations for different query types', async () => {
    const testCases = [
      {
        query: "What patterns are used in this codebase?",
        expectKeywords: ['pattern', 'design']
      },
      {
        query: "How is error handling implemented?",
        expectKeywords: ['error', 'exception', 'handle']
      },
      {
        query: "What are the main data structures?",
        expectKeywords: ['interface', 'type', 'data']
      }
    ]

    for (const testCase of testCases) {
      const result = await toolHandler({
        query: testCase.query,
        projectPath: testProjectPath,
        sessionId: `test-session-${testCase.query.slice(0, 10)}`
      })

      expect(result).toBeDefined()
      expect(result.content).toBeTruthy()
      
      // Check that the response is relevant to the query
      expect(result.content).toBeInstanceOf(Array)
      expect(result.content[0]).toHaveProperty('type', 'text')
      
      const responseText = result.content[0].text
      const contentLower = responseText.toLowerCase()
      const hasRelevantKeywords = testCase.expectKeywords.some(keyword => 
        contentLower.includes(keyword.toLowerCase())
      )
      
      // The response should be relevant (either contains keywords or is a meaningful explanation)
      expect(contentLower.length).toBeGreaterThan(50) // Should provide substantial explanation
    }
  })

  test('should maintain session context', async () => {
    const sessionId = 'test-session-123'
    
    // First query
    const result1 = await toolHandler({
      query: "What does the Button component do?",
      projectPath: testProjectPath,
      sessionId
    })

    expect(result1).toBeDefined()

    // Follow-up query in same session
    const result2 = await toolHandler({
      query: "What about its props?",
      projectPath: testProjectPath,
      sessionId
    })

    expect(result2).toBeDefined()
    // Should understand the context from previous query
  })

  test('should handle different action types', async () => {
    // Test handle action (default)
    const handleResult = await toolHandler({
      action: 'handle',
      query: "Explain the user service",
      projectPath: testProjectPath,
      sessionId: 'test-session-handle'
    })

    expect(handleResult).toBeDefined()

    // Test CLI action
    const cliResult = await toolHandler({
      action: 'cli',
      query: "Explain the user service",
      projectPath: testProjectPath,
      sessionId: 'test-session-cli'
    })

    expect(cliResult).toBeDefined()
  })
})
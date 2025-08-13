import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FixStrategyManager, FixStrategy } from '../../../src/tools/zod-core/fix-strategies'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'

describe('FixStrategyManager', () => {
  let manager: FixStrategyManager
  let tempDir: string

  beforeEach(async () => {
    manager = new FixStrategyManager()
    tempDir = join(tmpdir(), `zod-core-fix-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('debug', () => {
    it('should debug strategy registration', () => {
      // Test strategy retrieval
      const consoleStrategy = manager.getStrategy('no-console', 'javascript')
      console.log('Console strategy:', consoleStrategy ? 'Found' : 'Not found')
      expect(consoleStrategy).toBeDefined()

      const eqeqeqStrategy = manager.getStrategy('eqeqeq', 'javascript')
      console.log('Eqeqeq strategy:', eqeqeqStrategy ? 'Found' : 'Not found')
      expect(eqeqeqStrategy).toBeDefined()

      const anyStrategy = manager.getStrategy('no-any', 'typescript')
      console.log('Any strategy:', anyStrategy ? 'Found' : 'Not found')
      expect(anyStrategy).toBeDefined()

      // Test language detection
      console.log('test.js ->', manager.detectLanguage('test.js'))
      console.log('test.ts ->', manager.detectLanguage('test.ts'))
      console.log('test.py ->', manager.detectLanguage('test.py'))
      console.log('test.go ->', manager.detectLanguage('test.go'))
    })
  })

  describe('strategy registration and retrieval', () => {
    it('should register and retrieve custom strategies', () => {
      const customStrategy: FixStrategy = {
        name: 'custom-test',
        description: 'A custom test strategy',
        supportedLanguages: ['javascript'],
        supportedRules: ['custom-rule'],
        apply: async () => ({ success: true, fixedContent: 'fixed' })
      }

      manager.registerStrategy(customStrategy)
      const retrieved = manager.getStrategy('custom-rule', 'javascript')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('custom-test')
    })

    it('should return null for unsupported rule-language combinations', () => {
      const strategy = manager.getStrategy('unsupported-rule', 'javascript')
      expect(strategy).toBeNull()
    })

    it('should return null for unsupported languages', () => {
      const strategy = manager.getStrategy('no-console', 'unsupported-language')
      expect(strategy).toBeNull()
    })
  })

  describe('JavaScript/TypeScript fix strategies', () => {
    it('should fix console.log statements', async () => {
      const content = `function test() {
  console.log('Hello, World!');
  return true;
}`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'no-console',
        line: 2,
        message: 'console.log in production code'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).not.toContain('console.log')
      expect(result.backupPath).toBeDefined()
      
      // Cleanup backup file
      if (result.backupPath) {
        await fs.unlink(result.backupPath).catch(() => {})
      }
    })

    it('should fix loose equality operators', async () => {
      const content = `function test() {
  if (x == 5) {
    return true;
  }
  return false;
}`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'eqeqeq',
        line: 2,
        message: 'Use of loose equality (==)'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('===')
      expect(result.fixedContent).not.toContain(' == ')
      
      // Cleanup backup file
      if (result.backupPath) {
        await fs.unlink(result.backupPath).catch(() => {})
      }
    })

    it('should fix any types in TypeScript', async () => {
      const content = `
function processData(data: any) {
  return data;
}
`
      const tsFile = join(tempDir, 'test.ts')
      await fs.writeFile(tsFile, content)

      const issue = {
        rule: 'no-any',
        line: 2,
        message: 'Use of any type'
      }

      const result = await manager.applyFix(tsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain(': unknown')
      expect(result.fixedContent).not.toContain(': any')
    })

    it('should fix long lines', async () => {
      const content = `function test() { const veryLongVariableName = "This is a very long line that should be broken into multiple lines for better readability and maintainability"; return veryLongVariableName; }`
      
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'max-line-length',
        line: 1,
        message: 'Line too long'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent?.split('\n').length).toBeGreaterThan(1)
    })
  })

  describe('Python fix strategies', () => {
    it('should fix print statements', async () => {
      const content = `
def test_function():
    print("Hello, World!")
    return True
`
      const pyFile = join(tempDir, 'test.py')
      await fs.writeFile(pyFile, content)

      const issue = {
        rule: 'no-print',
        line: 3,
        message: 'print() statements should be removed'
      }

      const result = await manager.applyFix(pyFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).not.toContain('print(')
    })

    it('should fix wildcard imports', async () => {
      const content = `
from datetime import *
import os
`
      const pyFile = join(tempDir, 'test.py')
      await fs.writeFile(pyFile, content)

      const issue = {
        rule: 'no-wildcard-import',
        line: 2,
        message: 'Wildcard imports are discouraged'
      }

      const result = await manager.applyFix(pyFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('# TODO: Replace with specific imports')
    })
  })

  describe('Go fix strategies', () => {
    it('should fix fmt.Println statements', async () => {
      const content = `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`
      const goFile = join(tempDir, 'test.go')
      await fs.writeFile(goFile, content)

      const issue = {
        rule: 'no-fmt-println',
        line: 6,
        message: 'fmt.Println() should be replaced with proper logging'
      }

      const result = await manager.applyFix(goFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('log.Println(')
      expect(result.fixedContent).not.toContain('fmt.Println(')
    })

    it('should fix panic statements', async () => {
      const content = `package main

func main() {
    panic("error occurred")
}`
      const goFile = join(tempDir, 'test.go')
      await fs.writeFile(goFile, content)

      const issue = {
        rule: 'no-panic',
        line: 4,
        message: 'panic() should be avoided in production code'
      }

      const result = await manager.applyFix(goFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('// TODO: Replace panic with proper error handling')
    })
  })

  describe('Security fix strategies', () => {
    it('should fix eval() usage', async () => {
      const content = `function processData(data) {
    return eval(data);
}`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'no-eval',
        line: 2,
        message: 'Use of eval() is a security risk'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('// SECURITY: eval() removed')
    })

    it('should fix innerHTML usage', async () => {
      const content = `function updateContent(element, content) {
    element.innerHTML = content;
}`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'no-innerhtml',
        line: 2,
        message: 'innerHTML can lead to XSS attacks'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.fixedContent).toBeDefined()
      expect(result.fixedContent).toContain('textContent')
      expect(result.fixedContent).toContain('// SECURITY: innerHTML replaced')
    })
  })

  describe('safety checks', () => {
    it('should create backups before applying fixes', async () => {
      const content = 'console.log("test");'
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'no-console',
        line: 1,
        message: 'console.log in production code'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(true)
      expect(result.backupPath).toBeDefined()
      
      // Check that backup file exists
      const backupExists = await fs.access(result.backupPath!).then(() => true).catch(() => false)
      expect(backupExists).toBe(true)
    })

    it('should restore from backup on safety check failure', async () => {
      const content = 'console.log("test");'
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      // Register a strategy that fails safety checks
      const failingStrategy: FixStrategy = {
        name: 'failing-test',
        description: 'A strategy that fails safety checks',
        supportedLanguages: ['javascript'],
        supportedRules: ['failing-rule'],
        apply: async () => ({ 
          success: true, 
          fixedContent: 'a'.repeat(1024 * 1024 + 50) // Exceeds size limit by enough margin
        })
      }

      manager.registerStrategy(failingStrategy)

      const issue = {
        rule: 'failing-rule',
        line: 1,
        message: 'test issue'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Safety check')
      
      // Check that original content is restored
      const restoredContent = await fs.readFile(jsFile, 'utf8')
      expect(restoredContent).toBe(content)
    })
  })

  describe('error handling', () => {
    it('should handle invalid line numbers gracefully', async () => {
      const content = 'console.log("test");'
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'no-console',
        line: 999, // Invalid line number
        message: 'console.log in production code'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid line number')
    })

    it('should handle missing strategies gracefully', async () => {
      const content = 'test content'
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, content)

      const issue = {
        rule: 'non-existent-rule',
        line: 1,
        message: 'test issue'
      }

      const result = await manager.applyFix(jsFile, content, issue)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No fix strategy found')
    })
  })
}) 
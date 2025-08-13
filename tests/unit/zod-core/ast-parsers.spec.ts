import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ASTParser } from '../../../src/tools/zod-core/ast-parsers'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'

describe('ASTParser', () => {
  let parser: ASTParser
  let tempDir: string

  beforeEach(async () => {
    parser = new ASTParser()
    tempDir = join(tmpdir(), `zod-core-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('parseFile', () => {
    it('should parse JavaScript files successfully', async () => {
      const jsContent = `
function hello(name) {
  console.log('Hello, ' + name);
  return name;
}

const result = hello('World');
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await parser.parseFile(jsFile)

      expect(result.success).toBe(true)
      expect(result.language).toBe('javascript')
      expect(result.ast).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should parse TypeScript files successfully', async () => {
      const tsContent = `
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}

const user: User = { name: 'John', age: 30 };
const message = greet(user);
`
      const tsFile = join(tempDir, 'test.ts')
      await fs.writeFile(tsFile, tsContent)

      const result = await parser.parseFile(tsFile)

      expect(result.success).toBe(true)
      expect(result.language).toBe('typescript')
      expect(result.ast).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should parse Python files successfully', async () => {
      const pyContent = `
def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result += value
        return self.result

calc = Calculator()
result = calc.add(5)
`
      const pyFile = join(tempDir, 'test.py')
      await fs.writeFile(pyFile, pyContent)

      const result = await parser.parseFile(pyFile)

      expect(result.success).toBe(true)
      expect(result.language).toBe('python')
      expect(result.ast).toBeDefined()
      expect(result.ast?.body).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should parse Go files successfully', async () => {
      const goContent = `
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

func add(a, b int) int {
    return a + b
}
`
      const goFile = join(tempDir, 'test.go')
      await fs.writeFile(goFile, goContent)

      const result = await parser.parseFile(goFile)

      expect(result.success).toBe(true)
      expect(result.language).toBe('go')
      expect(result.ast).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should handle unsupported languages gracefully', async () => {
      const unsupportedFile = join(tempDir, 'test.xyz')
      await fs.writeFile(unsupportedFile, 'some content')

      const result = await parser.parseFile(unsupportedFile)

      expect(result.success).toBe(false)
      expect(result.language).toBe('unknown')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Unsupported language')
    })

    it('should handle parse errors gracefully', async () => {
      const invalidJsContent = `
function test() {
  // Missing closing brace
  console.log('test');
`
      const jsFile = join(tempDir, 'invalid.js')
      await fs.writeFile(jsFile, invalidJsContent)

      const result = await parser.parseFile(jsFile)

      // The parser should handle syntax errors gracefully
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('lintFile', () => {
    it('should lint JavaScript files and detect issues', async () => {
      const jsContent = `
function test() {
  console.log('test');  // Should trigger no-console rule
  var x = 5;  // Should trigger no-var rule
  if (x == 5) {  // Should trigger eqeqeq rule
    return true;
  }
  return false;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await parser.lintFile(jsFile)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should lint TypeScript files and detect type issues', async () => {
      const tsContent = `
function processData(data: any) {  // Should trigger no-any rule
  console.log(data);  // Should trigger no-console rule
  return data;
}

const result = processData('test');
`
      const tsFile = join(tempDir, 'test.ts')
      await fs.writeFile(tsFile, tsContent)

      const result = await parser.lintFile(tsFile)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should lint Python files and detect issues', async () => {
      const pyContent = `
import os
from datetime import *  # Should trigger no-wildcard-import rule

def test_function():
    print("Hello")  # Should trigger no-print rule
    # This is a very long line that should trigger the line-too-long rule because it exceeds the recommended 88 characters limit
    return True
`
      const pyFile = join(tempDir, 'test.py')
      await fs.writeFile(pyFile, pyContent)

      const result = await parser.lintFile(pyFile)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should lint Go files and detect issues', async () => {
      const goContent = `
package main

import "fmt"

func main() {
    fmt.Println("Hello")  // Should trigger no-fmt-println rule
    panic("error")  // Should trigger no-panic rule
}
`
      const goFile = join(tempDir, 'test.go')
      await fs.writeFile(goFile, goContent)

      const result = await parser.lintFile(goFile)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle linting errors gracefully', async () => {
      const invalidFile = join(tempDir, 'invalid.xyz')
      await fs.writeFile(invalidFile, 'invalid content')

      const result = await parser.lintFile(invalidFile)

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('language detection', () => {
    it('should detect JavaScript file extensions', async () => {
      const extensions = ['js', 'jsx', 'mjs']
      
      for (const ext of extensions) {
        const file = join(tempDir, `test.${ext}`)
        await fs.writeFile(file, 'console.log("test");')
        
        const result = await parser.parseFile(file)
        expect(result.language).toBe('javascript')
      }
    })

    it('should detect TypeScript file extensions', async () => {
      const extensions = ['ts', 'tsx']
      
      for (const ext of extensions) {
        const file = join(tempDir, `test.${ext}`)
        await fs.writeFile(file, 'const x: string = "test";')
        
        const result = await parser.parseFile(file)
        expect(result.language).toBe('typescript')
      }
    })

    it('should detect Python file extensions', async () => {
      const extensions = ['py', 'pyx']
      
      for (const ext of extensions) {
        const file = join(tempDir, `test.${ext}`)
        await fs.writeFile(file, 'print("test")')
        
        const result = await parser.parseFile(file)
        expect(result.language).toBe('python')
      }
    })

    it('should detect Go file extensions', async () => {
      const file = join(tempDir, 'test.go')
      await fs.writeFile(file, 'package main')
      
      const result = await parser.parseFile(file)
      expect(result.language).toBe('go')
    })
  })
}) 
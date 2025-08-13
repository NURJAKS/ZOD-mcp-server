import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoreAnalyzer } from '../../../src/tools/zod-core/core-analyze'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'

describe('CoreAnalyzer', () => {
  let analyzer: CoreAnalyzer
  let tempDir: string

  beforeEach(async () => {
    analyzer = new CoreAnalyzer()
    tempDir = join(tmpdir(), `zod-core-analyze-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('analyzeProject', () => {
    it('should analyze JavaScript files and detect issues', async () => {
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

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBeGreaterThan(0)
      expect(result.issuesFound).toBeGreaterThan(0)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should analyze TypeScript files and detect type issues', async () => {
      const tsContent = `
function processData(data: any) {  // Should trigger no-any rule
  console.log(data);  // Should trigger no-console rule
  return data;
}

const result = processData('test');
`
      const tsFile = join(tempDir, 'test.ts')
      await fs.writeFile(tsFile, tsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBeGreaterThan(0)
      expect(result.issuesFound).toBeGreaterThan(0)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should analyze Python files and detect issues', async () => {
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

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBeGreaterThan(0)
      expect(result.issuesFound).toBeGreaterThan(0)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should analyze Go files and detect issues', async () => {
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

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBeGreaterThan(0)
      expect(result.issuesFound).toBeGreaterThan(0)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should focus analysis on specific path', async () => {
      // Create files in different directories
      await fs.mkdir(join(tempDir, 'src'), { recursive: true })
      await fs.mkdir(join(tempDir, 'tests'), { recursive: true })

      const srcFile = join(tempDir, 'src', 'main.js')
      const testFile = join(tempDir, 'tests', 'test.js')
      
      await fs.writeFile(srcFile, 'console.log("src");')
      await fs.writeFile(testFile, 'console.log("test");')

      const result = await analyzer.analyzeProject(tempDir, 'src')

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBe(1) // Only src/main.js should be analyzed
      expect(result.issuesFound).toBeGreaterThan(0)
    })

    it('should apply different rulesets', async () => {
      const jsContent = `
function test() {
  console.log('test');
  if (x == 5) {
    return true;
  }
  return false;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Test strict ruleset
      const strictResult = await analyzer.analyzeProject(tempDir, undefined, 'strict')
      expect(strictResult.success).toBe(true)

      // Test security ruleset
      const securityResult = await analyzer.analyzeProject(tempDir, undefined, 'security')
      expect(securityResult.success).toBe(true)
    })

    it('should handle empty projects gracefully', async () => {
      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.filesAnalyzed).toBe(0)
      expect(result.issuesFound).toBe(0)
      expect(result.issues).toHaveLength(0)
    })

    it('should handle analysis errors gracefully', async () => {
      // Create a file that might cause analysis issues
      const problematicFile = join(tempDir, 'problematic.js')
      await fs.writeFile(problematicFile, 'invalid javascript syntax {')

      const result = await analyzer.analyzeProject(tempDir)

      // Should still succeed overall, even if individual files fail
      expect(result.success).toBe(true)
    })
  })

  describe('issue categorization', () => {
    it('should categorize security issues correctly', async () => {
      const jsContent = `
function dangerous() {
  eval('console.log("dangerous")');  // Should be security issue
  element.innerHTML = userInput;     // Should be security issue
}
`
      const jsFile = join(tempDir, 'security.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      const securityIssues = result.issues.filter(i => i.type === 'security')
      expect(securityIssues.length).toBeGreaterThan(0)
    })

    it('should categorize bug issues correctly', async () => {
      const jsContent = `
function buggy() {
  if (x == 5) {  // Should be bug issue
    return true;
  }
  return false;
}
`
      const jsFile = join(tempDir, 'buggy.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      const bugIssues = result.issues.filter(i => i.type === 'bug')
      expect(bugIssues.length).toBeGreaterThan(0)
    })

    it('should categorize performance issues correctly', async () => {
      const jsContent = `
async function performance() {
  const items = [1, 2, 3, 4, 5];
  items.forEach(async (item) => {  // Should be performance issue
    await processItem(item);
  });
}
`
      const jsFile = join(tempDir, 'performance.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      const performanceIssues = result.issues.filter(i => i.type === 'performance')
      expect(performanceIssues.length).toBeGreaterThan(0)
    })

    it('should categorize maintainability issues correctly', async () => {
      const jsContent = `
function maintainable() {
  console.log('test');  // Should be maintainability issue
  // TODO: Fix this later  // Should be maintainability issue
}
`
      const jsFile = join(tempDir, 'maintainable.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      const maintainabilityIssues = result.issues.filter(i => i.type === 'maintainability')
      expect(maintainabilityIssues.length).toBeGreaterThan(0)
    })
  })

  describe('issue severity levels', () => {
    it('should assign appropriate severity levels', async () => {
      const jsContent = `
function severityTest() {
  eval('dangerous');  // Should be critical
  console.log('test');  // Should be low
  if (x == 5) {  // Should be medium
    return true;
  }
  return false;
}
`
      const jsFile = join(tempDir, 'severity.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      
      const severities = result.issues.map(i => i.severity)
      expect(severities).toContain('critical')
      expect(severities).toContain('low')
      expect(severities).toContain('medium')
    })
  })

  describe('summary calculation', () => {
    it('should calculate correct summary statistics', async () => {
      const jsContent = `
function summaryTest() {
  eval('dangerous');  // Security
  console.log('test');  // Maintainability
  if (x == 5) {  // Bug
    return true;
  }
  items.forEach(async (item) => {  // Performance
    await processItem(item);
  });
  return false;
}
`
      const jsFile = join(tempDir, 'summary.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary.bugs).toBeGreaterThan(0)
      expect(result.summary.security).toBeGreaterThan(0)
      expect(result.summary.performance).toBeGreaterThan(0)
      expect(result.summary.maintainability).toBeGreaterThan(0)
    })
  })

  describe('getAnalysisResults', () => {
    it('should retrieve analysis results from database', async () => {
      // First run an analysis
      const jsContent = 'console.log("test");'
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      await analyzer.analyzeProject(tempDir)

      // Then retrieve results
      const results = await analyzer.getAnalysisResults()

      expect(results.issues).toBeDefined()
      expect(results.summary).toBeDefined()
      expect(results.summary.lastRun).toBeDefined()
    })
  })

  describe('AST-based analysis', () => {
    it('should perform AST-based analysis on JavaScript files', async () => {
      const jsContent = `
var oldStyle = 'test';  // Should trigger no-var rule via AST
function test() {
  console.log('test');
}
`
      const jsFile = join(tempDir, 'ast-test.js')
      await fs.writeFile(jsFile, jsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
      
      // Should have AST-based issues
      const astIssues = result.issues.filter(i => i.rule === 'no-var')
      expect(astIssues.length).toBeGreaterThan(0)
    })

    it('should handle AST parsing errors gracefully', async () => {
      const invalidJsContent = `
function test() {
  // Missing closing brace
  console.log('test');
`
      const jsFile = join(tempDir, 'invalid-ast.js')
      await fs.writeFile(jsFile, invalidJsContent)

      const result = await analyzer.analyzeProject(tempDir)

      expect(result.success).toBe(true)
      // Should still find some issues even if AST parsing fails
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })
}) 
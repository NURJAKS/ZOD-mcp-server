import { z } from 'zod'
import type { McpToolContext } from '../../types'
import { safeLog } from '../../utils'
import { ProjectAnalyzer } from '../../core/project-analyzer'
import { Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { join, isAbsolute, extname } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'
import { ASTParser } from './ast-parsers'

export interface AnalysisIssue {
  id: string
  type: 'bug' | 'code_smell' | 'security' | 'performance' | 'maintainability'
  severity: 'low' | 'medium' | 'high' | 'critical'
  file: string
  line: number
  column?: number
  message: string
  description: string
  suggestion?: string
  rule?: string
}

export interface AnalysisResult {
  success: boolean
  issuesFound: number
  filesAnalyzed: number
  duration: number
  issues: AnalysisIssue[]
  summary: {
    bugs: number
    codeSmells: number
    security: number
    performance: number
    maintainability: number
  }
}

export class CoreAnalyzer {
  private db!: Database
  private analyzer: ProjectAnalyzer
  private astParser: ASTParser
  private initialized = false
  private dbPath: string

  constructor(dbPath?: string) {
    // Use the same database as core index tool
    this.dbPath = dbPath || join(tmpdir(), 'zodcore_index.sqlite')
    this.analyzer = new ProjectAnalyzer()
    this.astParser = new ASTParser()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    await this.analyzer.initialize()
    
    // Handle database file issues
    await this.ensureValidDatabase()
    
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database })
    
    // Create analysis tables if they don't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_issues (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER,
        message TEXT NOT NULL,
        description TEXT NOT NULL,
        suggestion TEXT,
        rule TEXT,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        files_analyzed INTEGER NOT NULL,
        issues_found INTEGER NOT NULL,
        duration INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_issues_file ON analysis_issues (file);
      CREATE INDEX IF NOT EXISTS idx_issues_type ON analysis_issues (type);
      CREATE INDEX IF NOT EXISTS idx_issues_severity ON analysis_issues (severity);
    `)
    
    this.initialized = true
    safeLog(`CoreAnalyzer: initialized with database at ${this.dbPath}`)
  }

  private async ensureValidDatabase(): Promise<void> {
    try {
      // Check if database file exists
      const exists = await fs.access(this.dbPath).then(() => true).catch(() => false)
      if (!exists) {
        safeLog(`CoreAnalyzer: No indexed database found at ${this.dbPath}`, 'warn')
        return
      }
      
      // Check file size
      const stats = await fs.stat(this.dbPath)
      if (stats.size === 0) {
        await fs.unlink(this.dbPath)
        safeLog(`CoreAnalyzer: Removed empty database file`, 'warn')
        return
      }
      
      // Test database connection
      let testDb: Database | null = null
      try {
        testDb = await open({ 
          filename: this.dbPath, 
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READONLY
        })
        await testDb.get('SELECT 1')
      } catch (dbError) {
        safeLog(`CoreAnalyzer: Database validation failed: ${dbError}`, 'warn')
        throw dbError
      } finally {
        if (testDb) {
          try {
            await testDb.close()
          } catch (closeError) {
            safeLog(`CoreAnalyzer: Failed to close test database: ${closeError}`, 'warn')
          }
        }
      }
    } catch (error) {
      safeLog(`CoreAnalyzer: Database validation error: ${error}`, 'warn')
    }
  }

  async analyzeProject(projectPath: string, focusPath?: string, ruleset?: string): Promise<AnalysisResult> {
    const startTime = Date.now()
    const issues: AnalysisIssue[] = []
    let filesAnalyzed = 0

    try {
      await this.initialize()
      
      // Ensure project path is absolute
      const absoluteProjectPath = isAbsolute(projectPath) ? projectPath : join(process.cwd(), projectPath)
      
      // Discover files to analyze
      const files = await this.discoverFiles(absoluteProjectPath, focusPath)
      safeLog(`CoreAnalyzer: found ${files.length} files to analyze`)
      
      if (files.length === 0) {
        return {
          success: true,
          issuesFound: 0,
          filesAnalyzed: 0,
          duration: Date.now() - startTime,
          issues: [],
          summary: { bugs: 0, codeSmells: 0, security: 0, performance: 0, maintainability: 0 }
        }
      }

      // Analyze each file
      for (const filePath of files) {
        try {
          // Try to get content from database first, fallback to file system
          let content: string
          let language: string
          
          try {
            const relativePath = filePath.includes(process.cwd()) 
              ? filePath.replace(process.cwd(), '').replace(/^\/+/, '')
              : filePath
            const dbFile = await this.db.get('SELECT content, language FROM project_files WHERE path = ?', [relativePath])
            
            if (dbFile && dbFile.content) {
              content = dbFile.content
              language = dbFile.language || this.detectLanguage(filePath)
              safeLog(`CoreAnalyzer: Using content from database for ${relativePath}`)
            } else {
              content = await fs.readFile(filePath, 'utf8')
              language = this.detectLanguage(filePath)
              safeLog(`CoreAnalyzer: Using content from file system for ${filePath}`)
            }
          } catch (dbError) {
            // Fallback to file system
            content = await fs.readFile(filePath, 'utf8')
            language = this.detectLanguage(filePath)
            safeLog(`CoreAnalyzer: Fallback to file system for ${filePath}`)
          }
          
          const fileIssues = await this.analyzeFile(filePath, content, language, ruleset)
          
          // Also run AST-based analysis for supported languages
          if (['javascript', 'typescript', 'js', 'ts'].includes(language)) {
            try {
              const astIssues = await this.analyzeFileWithAST(filePath, content, language, ruleset)
              issues.push(...astIssues)
            } catch (error) {
              safeLog(`CoreAnalyzer: AST analysis failed for ${filePath}: ${error}`, 'warn')
            }
          }
          
          issues.push(...fileIssues)
          filesAnalyzed++
          
                // Store issues in database
      for (const issue of fileIssues) {
        try {
          await this.db.run(`
            INSERT INTO analysis_issues (id, type, severity, file, line, column, message, description, suggestion, rule, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            issue.id,
            issue.type,
            issue.severity,
            issue.file,
            issue.line,
            issue.column || null,
            issue.message,
            issue.description,
            issue.suggestion || null,
            issue.rule || null,
            Date.now()
          ])
        } catch (error) {
          // Skip duplicate issues
          if (!(error instanceof Error ? error.message : String(error)).includes('UNIQUE constraint failed')) {
            safeLog(`CoreAnalyzer: error storing issue: ${error instanceof Error ? error.message : String(error)}`, 'warn')
          }
        }
      }
        } catch (error) {
          safeLog(`CoreAnalyzer: error analyzing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`, 'warn')
        }
      }

      // Record analysis run
      await this.db.run(`
        INSERT INTO analysis_runs (started_at, completed_at, files_analyzed, issues_found, duration)
        VALUES (?, ?, ?, ?, ?)
      `, [startTime, Date.now(), filesAnalyzed, issues.length, Date.now() - startTime])

      const duration = Date.now() - startTime
      safeLog(`CoreAnalyzer: analyzed ${filesAnalyzed} files, found ${issues.length} issues in ${duration}ms`)

      const summary = this.calculateSummary(issues)
      return {
        success: true,
        issuesFound: issues.length,
        filesAnalyzed,
        duration,
        issues,
        summary
      }
    } catch (error) {
      safeLog(`CoreAnalyzer: analysis failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
      return {
        success: false,
        issuesFound: 0,
        filesAnalyzed: 0,
        duration: Date.now() - startTime,
        issues: [],
        summary: { bugs: 0, codeSmells: 0, security: 0, performance: 0, maintainability: 0 }
      }
    }
  }

  private async discoverFiles(projectPath: string, focusPath?: string): Promise<string[]> {
    try {
      // First try to get files from the indexed database
      const indexedFiles = await this.getIndexedFiles(projectPath, focusPath)
      if (indexedFiles.length > 0) {
        safeLog(`CoreAnalyzer: Using ${indexedFiles.length} indexed files from database`)
        return indexedFiles
      }
      
      // Fallback to file system discovery if no indexed files found
      safeLog(`CoreAnalyzer: No indexed files found, falling back to file system discovery`)
      return await this.discoverFilesFromFileSystem(projectPath, focusPath)
    } catch (error) {
      safeLog(`CoreAnalyzer: error discovering files: ${error instanceof Error ? error.message : String(error)}`, 'warn')
      return []
    }
  }

  private async getIndexedFiles(projectPath: string, focusPath?: string): Promise<string[]> {
    try {
      let query = `
        SELECT path, content FROM project_files 
        WHERE type = 'file' AND language IN ('typescript', 'javascript', 'python', 'go', 'java', 'cpp', 'c', 'csharp')
      `
      const params: any[] = []
      
      if (focusPath) {
        query += ` AND path LIKE ?`
        params.push(`${focusPath}%`)
      }
      
      const files = await this.db.all(query, params)
      
      const absoluteFiles = files.map(file => {
        const absolutePath = join(projectPath, file.path)
        return absolutePath
      })
      
      // Filter out non-existent files (tests may not have persisted files)
      const existing: string[] = []
      for (const f of absoluteFiles) {
        try {
          await fs.access(f)
          existing.push(f)
        } catch {}
      }
      
      return existing
    } catch (error) {
      safeLog(`CoreAnalyzer: error getting indexed files: ${error instanceof Error ? error.message : String(error)}`, 'warn')
      return []
    }
  }

  private async discoverFilesFromFileSystem(projectPath: string, focusPath?: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      // If focus path is specified, only analyze that path
      const targetPath = focusPath ? join(projectPath, focusPath) : projectPath
      
      // Use glob to find all code files
      const { glob } = await import('glob')
      const patterns = [
        '**/*.js',
        '**/*.ts',
        '**/*.jsx',
        '**/*.tsx',
        '**/*.py',
        '**/*.go',
        '**/*.java',
        '**/*.cpp',
        '**/*.c',
        '**/*.cs'
      ]
      
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          cwd: targetPath,
          absolute: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        })
        files.push(...matches)
      }
      
      // If focus path is specified, filter files to only include those in the focus path
      if (focusPath) {
        const focusDir = join(projectPath, focusPath)
        return files.filter(file => file.startsWith(focusDir))
      }
      
      // Remove duplicates and sort
      return [...new Set(files)].sort()
    } catch (error) {
      safeLog(`CoreAnalyzer: error discovering files from file system: ${error}`, 'warn')
      return []
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp'
    }
    return languageMap[ext] || 'unknown'
  }

  private async analyzeFile(filePath: string, content: string, language?: string, ruleset?: string): Promise<AnalysisIssue[]> {
    const issues: AnalysisIssue[] = []
    const lines = content.split('\n')
    
    // Get relative path for issue reporting
    const relativePath = filePath.includes(process.cwd()) 
      ? filePath.replace(process.cwd(), '').replace(/^\/+/, '')
      : filePath
    
    // Adjust severities/rules based on ruleset
    const strictMode = ruleset === 'strict'
    const securityMode = ruleset === 'security'
    
    // Basic static analysis rules
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      
      // Security issues
      if (line.includes('eval(') || line.includes('Function(')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:eval`,
          type: 'security',
          severity: 'critical',
          file: relativePath,
          line: lineNumber,
          message: 'Use of eval() or Function() constructor',
          description: 'eval() and Function() can execute arbitrary code and are security risks',
          suggestion: 'Use safer alternatives like JSON.parse() or structured data',
          rule: 'no-eval'
        })
      }
      
      if (line.includes('innerHTML') || line.includes('outerHTML')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:innerHTML`,
          type: 'security',
          severity: securityMode ? 'critical' : 'high',
          file: relativePath,
          line: lineNumber,
          message: 'Use of innerHTML/outerHTML',
          description: 'innerHTML can lead to XSS attacks if used with untrusted data',
          suggestion: 'Use textContent or createElement() instead',
          rule: 'no-innerHTML'
        })
      }
      
      // Code smells
      if (line.length > 120) {
        issues.push({
          id: `${relativePath}:${lineNumber}:long-line`,
          type: 'code_smell',
          severity: strictMode ? 'medium' : 'low',
          file: relativePath,
          line: lineNumber,
          message: 'Line too long',
          description: 'Lines longer than 120 characters can be hard to read',
          suggestion: 'Break the line into multiple lines',
          rule: 'max-line-length'
        })
      }
      
      // Add some low severity issues for better coverage
      if (line.includes('var ')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:var-usage`,
          type: 'code_smell',
          severity: 'low',
          file: relativePath,
          line: lineNumber,
          message: 'Use of var keyword',
          description: 'var has function scope and can lead to hoisting issues',
          suggestion: 'Use const or let instead of var',
          rule: 'no-var'
        })
      }
      
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:todo`,
          type: 'maintainability',
          severity: 'medium',
          file: relativePath,
          line: lineNumber,
          message: 'TODO/FIXME comment found',
          description: 'TODO and FIXME comments indicate incomplete work',
          suggestion: 'Address the TODO or create an issue to track it',
          rule: 'no-todo'
        })
      }
      
      // Performance issues
      if (line.includes('.forEach(') && line.includes('async')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:async-foreach`,
          type: 'performance',
          severity: 'medium',
          file: relativePath,
          line: lineNumber,
          message: 'Async forEach usage',
          description: 'forEach with async functions doesn\'t wait for promises',
          suggestion: 'Use for...of loop or Promise.all() with map()',
          rule: 'no-async-foreach'
        })
      }
      
      // Maintainability issues
      if (line.includes('any') && (language === 'typescript' || language === 'ts')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:any-type`,
          type: 'maintainability',
          severity: strictMode ? 'high' : 'medium',
          file: relativePath,
          line: lineNumber,
          message: 'Use of any type',
          description: 'any type bypasses TypeScript\'s type checking',
          suggestion: 'Use proper types or unknown instead',
          rule: 'no-any'
        })
      }
      
      // TypeScript-specific rules
      if (language === 'typescript' || language === 'ts') {
        if (line.includes('console.log(')) {
          issues.push({
            id: `${relativePath}:${lineNumber}:console-log-ts`,
            type: 'maintainability',
            severity: 'low',
            file: relativePath,
            line: lineNumber,
            message: 'console.log in TypeScript code',
            description: 'console.log statements should be removed from production TypeScript code',
            suggestion: 'Use proper logging library or remove the statement',
            rule: 'no-console'
          })
        }
      }
      
      // Bug patterns
      if (line.includes('==') && !line.includes('===')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:loose-equals`,
          type: 'bug',
          severity: strictMode ? 'high' : 'medium',
          file: relativePath,
          line: lineNumber,
          message: 'Use of loose equality (==)',
          description: 'Loose equality can lead to unexpected type coercion',
          suggestion: 'Use strict equality (===) instead',
          rule: 'eqeqeq'
        })
      }
      
      if (line.includes('console.log(')) {
        issues.push({
          id: `${relativePath}:${lineNumber}:console-log`,
          type: 'maintainability',
          severity: 'low',
          file: relativePath,
          line: lineNumber,
          message: 'console.log in production code',
          description: 'console.log statements should be removed from production code',
          suggestion: 'Use proper logging library or remove the statement',
          rule: 'no-console'
        })
      }
      
      // Language-specific rules
      if (language === 'python') {
        if (line.includes('print(')) {
          issues.push({
            id: `${relativePath}:${lineNumber}:print`,
            type: 'code_smell',
            severity: 'low',
            file: relativePath,
            line: lineNumber,
            message: 'print() in production code',
            description: 'print() statements should be removed from production code',
            suggestion: 'Use proper logging library or remove the statement',
            rule: 'no-print'
          })
        }
        
        if (line.includes('from ') && line.includes(' import *')) {
          issues.push({
            id: `${relativePath}:${lineNumber}:wildcard-import`,
            type: 'code_smell',
            severity: 'medium',
            file: relativePath,
            line: lineNumber,
            message: 'Wildcard import detected',
            description: 'Wildcard imports can pollute the namespace',
            suggestion: 'Import specific items instead of using wildcard imports',
            rule: 'no-wildcard-import'
          })
        }
      }
      
      if (language === 'go') {
        if (line.includes('fmt.Println(')) {
          issues.push({
            id: `${relativePath}:${lineNumber}:fmt-println`,
            type: 'code_smell',
            severity: 'low',
            file: relativePath,
            line: lineNumber,
            message: 'fmt.Println() in production code',
            description: 'fmt.Println() statements should be removed from production code',
            suggestion: 'Use proper logging library or remove the statement',
            rule: 'no-fmt-println'
          })
        }
        
        if (line.includes('panic(')) {
          issues.push({
            id: `${relativePath}:${lineNumber}:panic`,
            type: 'bug',
            severity: 'high',
            file: relativePath,
            line: lineNumber,
            message: 'panic() usage',
            description: 'panic() should be avoided in production code',
            suggestion: 'Use proper error handling instead of panic',
            rule: 'no-panic'
          })
        }
      }
    }
    
    // File-level analysis
    if (content.includes('export default') && content.includes('export {')) {
      issues.push({
        id: `${relativePath}:mixed-exports`,
        type: 'code_smell',
        severity: 'low',
        file: relativePath,
        line: 1,
        message: 'Mixed export styles',
        description: 'File uses both default and named exports',
        suggestion: 'Choose one export style for consistency',
        rule: 'consistent-exports'
      })
    }
    
    return issues
  }

  private async analyzeFileWithAST(filePath: string, content: string, language?: string, ruleset?: string): Promise<AnalysisIssue[]> {
    const issues: AnalysisIssue[] = []
    
    try {
      // Parse file with AST parser
      const parseResult = await this.astParser.parseFile(filePath)
      
      if (!parseResult.success) {
        // Add parse error as an issue
        issues.push({
          id: `${filePath}:parse-error`,
          type: 'bug',
          severity: 'critical',
          file: filePath,
          line: 1,
          message: 'File parsing failed',
          description: `AST parser could not parse the file: ${parseResult.errors.join(', ')}`,
          suggestion: 'Check file syntax and ensure it follows language conventions',
          rule: 'parse-error'
        })
        return issues
      }

      // Lint file with AST parser
      const lintResult = await this.astParser.lintFile(filePath)
      
      if (!lintResult.success) {
        issues.push({
          id: `${filePath}:lint-error`,
          type: 'bug',
          severity: 'high',
          file: filePath,
          line: 1,
          message: 'Linting failed',
          description: `Linter could not analyze the file: ${lintResult.errors.join(', ')}`,
          suggestion: 'Check file syntax and linting configuration',
          rule: 'lint-error'
        })
        return issues
      }

      // Convert lint issues to analysis issues
      for (const lintIssue of lintResult.issues) {
        const severity = lintIssue.severity === 2 ? 'high' : 
                        lintIssue.severity === 1 ? 'medium' : 'low'
        
        const type = this.mapRuleToIssueType(lintIssue.ruleId)
        
        issues.push({
          id: `${filePath}:${lintIssue.line}:${lintIssue.ruleId}`,
          type,
          severity,
          file: filePath,
          line: lintIssue.line,
          column: lintIssue.column,
          message: lintIssue.message,
          description: `AST-based analysis detected: ${lintIssue.message}`,
          suggestion: this.getSuggestionForRule(lintIssue.ruleId),
          rule: lintIssue.ruleId
        })
      }

      // Additional AST-based analysis
      if (parseResult.ast) {
        const astIssues = this.analyzeAST(parseResult.ast, filePath, content)
        issues.push(...astIssues)
      }

    } catch (error) {
      safeLog(`AST analysis failed for ${filePath}: ${error}`, 'warn')
    }

    return issues
  }

  private analyzeAST(ast: any, filePath: string, content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    
    try {
      // Analyze AST structure for additional issues
      if (ast.type === 'Program' && ast.body) {
        // Check for common JavaScript/TypeScript issues
        for (const node of ast.body) {
          issues.push(...this.analyzeNode(node, filePath, content))
        }
      }
      
      // Language-specific analysis
      const language = this.detectLanguage(filePath)
      if (language === 'typescript' || language === 'javascript') {
        issues.push(...this.analyzeJavaScriptAST(ast, filePath, content))
      } else if (language === 'python') {
        issues.push(...this.analyzePythonAST(ast, filePath, content))
      } else if (language === 'java') {
        issues.push(...this.analyzeJavaAST(ast, filePath, content))
      }
      
    } catch (error) {
      safeLog(`AST analysis error for ${filePath}: ${error}`, 'warn')
    }

    return issues
  }

  private analyzeNode(node: any, filePath: string, content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    
    if (!node) return issues
    
    try {
      // Variable declarations
      if (node.type === 'VariableDeclaration') {
        if (node.kind === 'var') {
          issues.push({
            id: `${filePath}:${node.loc?.start?.line || 1}:var-declaration`,
            type: 'code_smell',
            severity: 'medium',
            file: filePath,
            line: node.loc?.start?.line || 1,
            message: 'Use of var declaration',
            description: 'var declarations are function-scoped and can lead to hoisting issues',
            suggestion: 'Use const or let instead of var',
            rule: 'no-var'
          })
        }
        
        // Check for unused variables
        if (node.declarations && node.declarations.length > 0) {
          for (const decl of node.declarations) {
            if (decl.id && decl.id.name && !this.isVariableUsed(decl.id.name, content)) {
              issues.push({
                id: `${filePath}:${node.loc?.start?.line || 1}:unused-variable`,
                type: 'bug',
                severity: 'low',
                file: filePath,
                line: node.loc?.start?.line || 1,
                message: `Unused variable: ${decl.id.name}`,
                description: 'Variable is declared but never used',
                suggestion: 'Remove unused variable or use it in your code',
                rule: 'no-unused-vars'
              })
            }
          }
        }
      }
      
      // Function declarations
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        if (node.params && node.params.length > 3) {
          issues.push({
            id: `${filePath}:${node.loc?.start?.line || 1}:too-many-params`,
            type: 'code_smell',
            severity: 'medium',
            file: filePath,
            line: node.loc?.start?.line || 1,
            message: 'Function has too many parameters',
            description: `Function has ${node.params.length} parameters, consider using an object parameter`,
            suggestion: 'Refactor to use object destructuring or break into smaller functions',
            rule: 'max-params'
          })
        }
      }
      
      // Loops and performance
      if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
        if (node.body && node.body.type === 'BlockStatement' && node.body.body.length > 10) {
          issues.push({
            id: `${filePath}:${node.loc?.start?.line || 1}:large-loop-body`,
            type: 'performance',
            severity: 'medium',
            file: filePath,
            line: node.loc?.start?.line || 1,
            message: 'Large loop body detected',
            description: 'Loop body contains many statements which can impact performance',
            suggestion: 'Extract loop body into a separate function for better readability and performance',
            rule: 'max-loop-body-size'
          })
        }
      }
      
      // Security checks
      if (node.type === 'CallExpression') {
        if (node.callee && node.callee.name === 'eval') {
          issues.push({
            id: `${filePath}:${node.loc?.start?.line || 1}:eval-usage`,
            type: 'security',
            severity: 'critical',
            file: filePath,
            line: node.loc?.start?.line || 1,
            message: 'Use of eval() detected',
            description: 'eval() can execute arbitrary code and is a security risk',
            suggestion: 'Use safer alternatives like JSON.parse() or Function constructor',
            rule: 'no-eval'
          })
        }
        
        if (node.callee && node.callee.property && node.callee.property.name === 'innerHTML') {
          issues.push({
            id: `${filePath}:${node.loc?.start?.line || 1}:innerhtml-usage`,
            type: 'security',
            severity: 'high',
            file: filePath,
            line: node.loc?.start?.line || 1,
            message: 'Use of innerHTML detected',
            description: 'innerHTML can lead to XSS attacks if used with user input',
            suggestion: 'Use textContent or createElement for safer DOM manipulation',
            rule: 'no-innerhtml'
          })
        }
      }
      
      // Recursively analyze child nodes
      if (node.body && Array.isArray(node.body)) {
        for (const child of node.body) {
          issues.push(...this.analyzeNode(child, filePath, content))
        }
      }
      
      if (node.expression) {
        issues.push(...this.analyzeNode(node.expression, filePath, content))
      }
      
    } catch (error) {
      safeLog(`Node analysis error: ${error}`, 'warn')
    }
    
    return issues
  }

  private analyzeJavaScriptAST(ast: any, filePath: string, content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    
    try {
      // TypeScript/JavaScript specific patterns
      if (ast.type === 'Program' && ast.body) {
        for (const node of ast.body) {
          // Check for any type usage
          if (node.type === 'TSTypeAnnotation' && node.typeAnnotation && node.typeAnnotation.typeName === 'any') {
            issues.push({
              id: `${filePath}:${node.loc?.start?.line || 1}:any-type`,
              type: 'maintainability',
              severity: 'medium',
              file: filePath,
              line: node.loc?.start?.line || 1,
              message: 'Use of any type detected',
              description: 'any type bypasses TypeScript type checking',
              suggestion: 'Use proper types or unknown for better type safety',
              rule: 'no-any'
            })
          }
          
          // Check for console usage in production code
          if (node.type === 'ExpressionStatement' && 
              node.expression && 
              node.expression.type === 'CallExpression' &&
              node.expression.callee &&
              node.expression.callee.object &&
              node.expression.callee.object.name === 'console') {
            issues.push({
              id: `${filePath}:${node.loc?.start?.line || 1}:console-usage`,
              type: 'maintainability',
              severity: 'low',
              file: filePath,
              line: node.loc?.start?.line || 1,
              message: 'Console usage detected',
              description: 'Console statements should not be in production code',
              suggestion: 'Use a proper logging library or remove console statements',
              rule: 'no-console'
            })
          }
        }
      }
    } catch (error) {
      safeLog(`JavaScript AST analysis error: ${error}`, 'warn')
    }
    
    return issues
  }

  private analyzePythonAST(ast: any, filePath: string, content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    
    try {
      // Python-specific patterns
      if (ast.type === 'Module' && ast.body) {
        for (const node of ast.body) {
          // Check for bare except clauses
          if (node.type === 'Try' && node.handlers) {
            for (const handler of node.handlers) {
              if (!handler.type || handler.type === 'ExceptHandler' && !handler.type) {
                issues.push({
                  id: `${filePath}:${node.loc?.start?.line || 1}:bare-except`,
                  type: 'bug',
                  severity: 'high',
                  file: filePath,
                  line: node.loc?.start?.line || 1,
                  message: 'Bare except clause detected',
                  description: 'Bare except clauses catch all exceptions including SystemExit and KeyboardInterrupt',
                  suggestion: 'Specify exception types or use except Exception:',
                  rule: 'no-bare-except'
                })
              }
            }
          }
          
          // Check for unused imports
          if (node.type === 'Import' || node.type === 'ImportFrom') {
            // This would require more sophisticated analysis to detect truly unused imports
            // For now, we'll skip this check
          }
        }
      }
    } catch (error) {
      safeLog(`Python AST analysis error: ${error}`, 'warn')
    }
    
    return issues
  }

  private analyzeJavaAST(ast: any, filePath: string, content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    
    try {
      // Java-specific patterns
      if (ast.type === 'CompilationUnit' && ast.types) {
        for (const type of ast.types) {
          if (type.type === 'ClassOrInterfaceDeclaration') {
            // Check for public fields
            if (type.bodyDeclarations) {
              for (const member of type.bodyDeclarations) {
                if (member.type === 'FieldDeclaration' && member.modifiers) {
                  const isPublic = member.modifiers.some((mod: any) => mod.keyword === 'public')
                  const isFinal = member.modifiers.some((mod: any) => mod.keyword === 'final')
                  
                  if (isPublic && !isFinal) {
                    issues.push({
                      id: `${filePath}:${member.loc?.start?.line || 1}:public-field`,
                      type: 'code_smell',
                      severity: 'medium',
                      file: filePath,
                      line: member.loc?.start?.line || 1,
                      message: 'Public field detected',
                      description: 'Public fields break encapsulation',
                      suggestion: 'Make field private and provide getter/setter methods',
                      rule: 'no-public-fields'
                    })
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      safeLog(`Java AST analysis error: ${error}`, 'warn')
    }
    
    return issues
  }

  private isVariableUsed(varName: string, content: string): boolean {
    // Simple check for variable usage - in production you'd want more sophisticated analysis
    const lines = content.split('\n')
    let declarationLine = -1
    
    // Find declaration line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`let ${varName}`) || lines[i].includes(`const ${varName}`) || lines[i].includes(`var ${varName}`)) {
        declarationLine = i
        break
      }
    }
    
    if (declarationLine === -1) return false
    
    // Check if variable is used after declaration
    for (let i = declarationLine + 1; i < lines.length; i++) {
      if (lines[i].includes(varName) && !lines[i].includes(`let ${varName}`) && !lines[i].includes(`const ${varName}`) && !lines[i].includes(`var ${varName}`)) {
        return true
      }
    }
    
    return false
  }

  private mapRuleToIssueType(ruleId: string): AnalysisIssue['type'] {
    const securityRules = [
      'no-eval', 'no-innerhtml', 'security/detect-eval-with-expression',
      'no-unsafe-regex', 'no-unsafe-assignment', 'no-unsafe-call',
      'no-unsafe-member-access', 'no-unsafe-return', 'no-unsafe-argument'
    ]
    const bugRules = [
      'eqeqeq', 'no-unused-vars', 'no-unused-expressions',
      'no-undef', 'no-unreachable', 'no-dupe-keys',
      'no-dupe-args', 'no-dupe-else-if', 'no-constant-condition'
    ]
    const performanceRules = [
      'no-async-foreach', 'no-for-loop', 'no-nested-loops',
      'no-expensive-operations', 'no-memory-leaks', 'no-sync-in-loop'
    ]
    const maintainabilityRules = [
      'no-any', 'no-console', 'no-todo', 'no-debugger',
      'max-lines', 'max-params', 'max-depth', 'complexity'
    ]
    
    if (securityRules.some(rule => ruleId.includes(rule))) return 'security'
    if (bugRules.some(rule => ruleId.includes(rule))) return 'bug'
    if (performanceRules.some(rule => ruleId.includes(rule))) return 'performance'
    if (maintainabilityRules.some(rule => ruleId.includes(rule))) return 'maintainability'
    
    return 'code_smell'
  }

  private getSuggestionForRule(ruleId: string): string {
    const suggestions: Record<string, string> = {
      // JavaScript/TypeScript rules
      'no-console': 'Use a proper logging library instead of console.log',
      'eqeqeq': 'Use strict equality (===) instead of loose equality (==)',
      'no-any': 'Use proper TypeScript types instead of any',
      'no-eval': 'Use safer alternatives like JSON.parse() or structured data',
      'no-innerhtml': 'Use textContent or createElement() to prevent XSS',
      'no-async-foreach': 'Use for...of loop or Promise.all() with map()',
      'no-var': 'Use const or let instead of var for better scoping',
      'no-todo': 'Address TODO comments or create issues to track them',
      'max-line-length': 'Break long lines for better readability',
      'no-unused-vars': 'Remove unused variables or use them in your code',
      'no-undef': 'Declare variables before using them or import from modules',
      'no-unreachable': 'Remove unreachable code or fix the logic flow',
      'no-dupe-keys': 'Remove duplicate object keys or merge their values',
      'no-dupe-args': 'Remove duplicate function parameters',
      'no-dupe-else-if': 'Consolidate duplicate else-if conditions',
      'no-constant-condition': 'Fix the condition or remove the loop/conditional',
      
      // Python rules
      'no-print': 'Remove print statements from production code',
      'no-bare-except': 'Specify exception types or use except Exception:',
      'no-unused-import': 'Remove unused imports or use them in your code',
      'no-wildcard-import': 'Import specific items instead of using *',
      'no-mutable-default': 'Use None as default and initialize in function body',
      'no-global': 'Avoid global variables, pass as parameters instead',
      
      // Java rules
      'no-public-fields': 'Make fields private and provide getter/setter methods',
      'no-raw-types': 'Use generic types instead of raw types',
      'no-unchecked-cast': 'Add proper type checking before casting',
      'no-deprecated': 'Use the recommended alternative instead of deprecated methods',
      'no-unused-private': 'Remove unused private methods or make them public if needed',
      
      // Go rules
      'no-fmt-println': 'Use proper logging instead of fmt.Println',
      'no-panic': 'Use proper error handling instead of panic',
      'no-unused-var': 'Remove unused variables or use underscore prefix',
      'no-shadow': 'Rename shadowed variables to avoid confusion',
      
      // General rules
      'max-params': 'Refactor to use object destructuring or break into smaller functions',
      'max-lines': 'Break large functions into smaller, focused functions',
      'max-depth': 'Reduce nesting by extracting conditions or using early returns',
      'complexity': 'Simplify complex logic by breaking into smaller functions',
      'max-loop-body-size': 'Extract loop body into a separate function',
      'no-unsafe-regex': 'Use specific regex patterns instead of overly broad ones',
      'no-unsafe-assignment': 'Add type checking before assignment',
      'no-unsafe-call': 'Validate parameters before function calls',
      'no-unsafe-member-access': 'Check object existence before accessing properties',
      'no-unsafe-return': 'Validate return values before returning',
      'no-unsafe-argument': 'Validate arguments before passing to functions',
      'no-nested-loops': 'Consider using more efficient algorithms or data structures',
      'no-expensive-operations': 'Move expensive operations outside loops or cache results',
      'no-memory-leaks': 'Ensure proper cleanup of resources and event listeners',
      'no-sync-in-loop': 'Use async/await or Promise.all() for better performance',
      'no-debugger': 'Remove debugger statements from production code'
    }
    
    return suggestions[ruleId] || 'Review and fix the identified issue based on best practices for your programming language'
  }

  async getAnalysisResults(): Promise<{ issues: AnalysisIssue[]; summary: any }> {
    await this.initialize()
    
    const issues = await this.db.all('SELECT * FROM analysis_issues ORDER BY severity DESC, file, line')
    const runs = await this.db.all('SELECT * FROM analysis_runs ORDER BY started_at DESC LIMIT 1')
    
    const analysisIssues: AnalysisIssue[] = issues.map(i => ({
      id: i.id,
      type: i.type as any,
      severity: i.severity as any,
      file: i.file,
      line: i.line,
      column: i.column,
      message: i.message,
      description: i.description,
      suggestion: i.suggestion,
      rule: i.rule
    }))
    
    const summary = {
      bugs: analysisIssues.filter(i => i.type === 'bug').length,
      codeSmells: analysisIssues.filter(i => i.type === 'code_smell').length,
      security: analysisIssues.filter(i => i.type === 'security').length,
      performance: analysisIssues.filter(i => i.type === 'performance').length,
      maintainability: analysisIssues.filter(i => i.type === 'maintainability').length,
      lastRun: runs[0] ? new Date(runs[0].started_at).toLocaleString() : 'Never'
    }
    
    return { issues: analysisIssues, summary }
  }

  private calculateSummary(issues: AnalysisIssue[]): AnalysisResult['summary'] {
    return {
      bugs: issues.filter(i => i.type === 'bug').length,
      codeSmells: issues.filter(i => i.type === 'code_smell').length,
      security: issues.filter(i => i.type === 'security').length,
      performance: issues.filter(i => i.type === 'performance').length,
      maintainability: issues.filter(i => i.type === 'maintainability').length
    }
  }
}

export function registerCoreAnalyzeTool({ mcp }: McpToolContext) {
  const analyzer = new CoreAnalyzer()

  mcp.tool(
    'core_analyze',
    'Core Analyze — Uses real AST parsers and linters to analyze code for bugs, code smells, and security issues.',
    {
      // Align with spec
      rules: z.array(z.string()).optional().describe('Which analysis rules to apply'),
      path: z.string().optional().describe('Specific file or directory to focus on'),
    },
    async (input) => {
      try {
        const projectPath = process.cwd()
        const focusPath = input.path && !input.path.startsWith('/') ? input.path : input.path
        const result = await analyzer.analyzeProject(projectPath, focusPath, input.rules?.[0])
        
        const issueText = result.issues.length > 0 
          ? `\n\n🔍 Issues Found:\n${result.issues.slice(0, 10).map(i => 
              `  ${i.severity.toUpperCase()} [${i.type}] ${i.file}:${i.line} - ${i.message}`
            ).join('\n')}${result.issues.length > 10 ? `\n  ... and ${result.issues.length - 10} more` : ''}`
          : '\n\n✅ No issues found!'
        
        return {
          content: [{ 
            type: 'text' as const, 
            text: result.success 
              ? `✅ Analysis completed successfully!\n\n` +
                `📁 Files analyzed: ${result.filesAnalyzed}\n` +
                `🐛 Issues found: ${result.issuesFound}\n` +
                `⏱️ Duration: ${result.duration}ms` +
                issueText
              : `❌ Analysis failed!` 
          }],
          metadata: {
            success: result.success,
            issuesFound: result.issuesFound,
            filesAnalyzed: result.filesAnalyzed,
            duration: result.duration,
            issues: result.issues,
            summary: result.summary
          }
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text' as const, 
            text: `❌ Core Analyze error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }],
          metadata: {
            error: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    }
  )

  return { analyzer }
} 
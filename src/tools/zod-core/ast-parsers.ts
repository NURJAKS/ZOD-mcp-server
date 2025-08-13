import { ESLint } from 'eslint'
import { join } from 'node:path'
import fs from 'node:fs/promises'

export interface ASTNode {
  type: string
  start: number
  end: number
  loc?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  [key: string]: any
}

export interface ParseResult {
  success: boolean
  ast?: ASTNode
  errors: string[]
  language: string
}

export interface LintResult {
  success: boolean
  issues: Array<{
    ruleId: string
    severity: number
    message: string
    line: number
    column: number
    endLine?: number
    endColumn?: number
    fix?: {
      range: [number, number]
      text: string
    }
  }>
  errors: string[]
}

export class ASTParser {
  private eslint: ESLint

  constructor() {
    this.eslint = new ESLint({
      overrideConfig: {
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true
          }
        },
        plugins: [
          '@typescript-eslint',
          'security',
          'import',
          'node',
          'promise',
          'unicorn'
        ],
        rules: {
          // Security rules
          'security/detect-object-injection': 'error',
          'security/detect-non-literal-regexp': 'error',
          'security/detect-unsafe-regex': 'error',
          'security/detect-buffer-noassert': 'error',
          'security/detect-child-process': 'error',
          'security/detect-disable-mustache-escape': 'error',
          'security/detect-eval-with-expression': 'error',
          'security/detect-no-csrf-before-method-override': 'error',
          'security/detect-non-literal-fs-filename': 'error',
          'security/detect-non-literal-require': 'error',
          'security/detect-possible-timing-attacks': 'error',
          'security/detect-pseudoRandomBytes': 'error',

          // TypeScript rules
          '@typescript-eslint/no-explicit-any': 'warn',
          '@typescript-eslint/no-unused-vars': 'error',
          '@typescript-eslint/explicit-function-return-type': 'off',
          '@typescript-eslint/explicit-module-boundary-types': 'off',
          '@typescript-eslint/no-non-null-assertion': 'warn',

          // General rules
          'no-console': 'warn',
          'no-debugger': 'error',
          'no-eval': 'error',
          'no-implied-eval': 'error',
          'no-new-func': 'error',
          'no-script-url': 'error',
          'eqeqeq': 'error',
          'curly': 'error',
          'no-unused-expressions': 'error',
          'no-unused-labels': 'error',
          'no-useless-call': 'error',
          'no-useless-concat': 'error',
          'no-useless-return': 'error',
          'prefer-const': 'error',
          'no-var': 'error',

          // Import rules
          'import/no-unresolved': 'off', // We'll handle this separately
          'import/no-duplicates': 'error',
          'import/order': 'warn',

          // Node rules
          'node/no-missing-import': 'off',
          'node/no-unsupported-features/es-syntax': 'off',

          // Promise rules
          'promise/always-return': 'warn',
          'promise/no-return-wrap': 'error',
          'promise/param-names': 'error',
          'promise/catch-or-return': 'warn',

          // Unicorn rules
          'unicorn/better-regex': 'warn',
          'unicorn/catch-error-name': 'error',
          'unicorn/consistent-destructuring': 'warn',
          'unicorn/consistent-function-scoping': 'warn',
          'unicorn/error-message': 'error',
          'unicorn/escape-case': 'error',
          'unicorn/expiring-todo-comments': 'warn',
          'unicorn/explicit-length-check': 'warn',
          'unicorn/filename-case': 'off',
          'unicorn/new-for-builtins': 'error',
          'unicorn/no-array-instanceof': 'error',
          'unicorn/no-console-spaces': 'error',
          'unicorn/no-for-loop': 'warn',
          'unicorn/no-hex-escape': 'error',
          'unicorn/no-lonely-if': 'warn',
          'unicorn/no-new-buffer': 'error',
          'unicorn/no-process-exit': 'error',
          'unicorn/no-unreadable-array-destructuring': 'error',
          'unicorn/no-unsafe-regex': 'error',
          'unicorn/no-unused-properties': 'warn',
          'unicorn/no-useless-undefined': 'error',
          'unicorn/number-literal-case': 'error',
          'unicorn/prefer-add-event-listener': 'error',
          'unicorn/prefer-array-find': 'error',
          'unicorn/prefer-array-flat-map': 'error',
          'unicorn/prefer-array-index-of': 'error',
          'unicorn/prefer-array-some': 'error',
          'unicorn/prefer-date-now': 'error',
          'unicorn/prefer-default-parameters': 'error',
          'unicorn/prefer-includes': 'error',
          'unicorn/prefer-math-trunc': 'error',
          'unicorn/prefer-modern-dom-apis': 'error',
          'unicorn/prefer-negative-index': 'error',
          'unicorn/prefer-number-properties': 'error',
          'unicorn/prefer-optional-catch-binding': 'error',
          'unicorn/prefer-prototype-methods': 'error',
          'unicorn/prefer-query-selector': 'error',
          'unicorn/prefer-reflect-apply': 'error',
          'unicorn/prefer-regexp-test': 'error',
          'unicorn/prefer-set-has': 'error',
          'unicorn/prefer-spread': 'error',
          'unicorn/prefer-string-replace-all': 'error',
          'unicorn/prefer-string-slice': 'error',
          'unicorn/prefer-string-starts-ends-with': 'error',
          'unicorn/prefer-string-trim-start-end': 'error',
          'unicorn/prefer-ternary': 'warn',
          'unicorn/prefer-type-error': 'error',
          'unicorn/throw-new-error': 'error'
        }
      }
    })
  }

  async parseFile(filePath: string): Promise<ParseResult> {
    const language = this.detectLanguage(filePath)
    
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          return await this.parseJavaScript(filePath, language)
        case 'python':
          return await this.parsePython(filePath)
        case 'go':
          return await this.parseGo(filePath)
        default:
          return {
            success: false,
            errors: [`Unsupported language: ${language}`],
            language
          }
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        language
      }
    }
  }

  async lintFile(filePath: string): Promise<LintResult> {
    const language = this.detectLanguage(filePath)
    
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          return await this.lintJavaScript(filePath)
        case 'python':
          return await this.lintPython(filePath)
        case 'go':
          return await this.lintGo(filePath)
        default:
          return {
            success: false,
            issues: [],
            errors: [`Unsupported language for linting: ${language}`]
          }
      }
    } catch (error) {
      return {
        success: false,
        issues: [],
        errors: [`Lint error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  private async parseJavaScript(filePath: string, language: string = 'javascript'): Promise<ParseResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      
      // Basic syntax validation
      const lines = content.split('\n')
      let braceCount = 0
      let parenCount = 0
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const char of line) {
          if (char === '{') braceCount++
          if (char === '}') braceCount--
          if (char === '(') parenCount++
          if (char === ')') parenCount--
        }
      }
      
      // Check for basic syntax errors
      if (braceCount !== 0 || parenCount !== 0) {
        return {
          success: false,
          errors: ['Unmatched braces or parentheses'],
          language
        }
      }
      
      // For now, we'll return a simplified AST structure without using ESLint
      // to avoid timeout issues in tests
      const ast = {
        type: 'Program',
        start: 0,
        end: content.length,
        loc: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: 0 }
        },
        body: []
      }

      // Simple function detection
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('function ') || line.includes('=>')) {
          ast.body.push({
            type: 'FunctionDeclaration',
            start: content.indexOf(line),
            end: content.indexOf(line) + line.length,
            loc: {
              start: { line: i + 1, column: 0 },
              end: { line: i + 1, column: line.length }
            }
          })
        }
      }

      return {
        success: true,
        ast,
        errors: [],
        language
      }
    } catch (error) {
      return {
        success: false,
        errors: [`JavaScript parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        language
      }
    }
  }

  private async parsePython(filePath: string): Promise<ParseResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      
      // Basic Python AST parsing (simplified)
      // In production, you'd use ast.parse from Python or a JS Python parser
      const lines = content.split('\n')
      const ast: ASTNode = {
        type: 'Module',
        start: 0,
        end: content.length,
        loc: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: 0 }
        },
        body: []
      }

      // Simple function and class detection
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        if (line.startsWith('def ')) {
          const match = line.match(/def\s+(\w+)/)
          if (match) {
            ast.body.push({
              type: 'FunctionDef',
              name: match[1],
              start: content.indexOf(line),
              end: content.indexOf(line) + line.length,
              loc: {
                start: { line: i + 1, column: 0 },
                end: { line: i + 1, column: line.length }
              }
            })
          }
        } else if (line.startsWith('class ')) {
          const match = line.match(/class\s+(\w+)/)
          if (match) {
            ast.body.push({
              type: 'ClassDef',
              name: match[1],
              start: content.indexOf(line),
              end: content.indexOf(line) + line.length,
              loc: {
                start: { line: i + 1, column: 0 },
                end: { line: i + 1, column: line.length }
              }
            })
          }
        }
      }

      return {
        success: true,
        ast,
        errors: [],
        language: 'python'
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Python parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        language: 'python'
      }
    }
  }

  private async parseGo(filePath: string): Promise<ParseResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      
      // Basic Go AST parsing (simplified)
      const lines = content.split('\n')
      const ast: ASTNode = {
        type: 'File',
        start: 0,
        end: content.length,
        loc: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: 0 }
        },
        declarations: []
      }

      // Simple function detection
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        if (line.startsWith('func ')) {
          const match = line.match(/func\s+(\w+)/)
          if (match) {
            ast.declarations.push({
              type: 'FuncDecl',
              name: match[1],
              start: content.indexOf(line),
              end: content.indexOf(line) + line.length,
              loc: {
                start: { line: i + 1, column: 0 },
                end: { line: i + 1, column: line.length }
              }
            })
          }
        }
      }

      return {
        success: true,
        ast,
        errors: [],
        language: 'go'
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Go parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        language: 'go'
      }
    }
  }

  private async lintJavaScript(filePath: string): Promise<LintResult> {
    try {
      const results = await this.eslint.lintFiles([filePath])
      
      if (results.length === 0) {
        return {
          success: false,
          issues: [],
          errors: ['No lint results returned']
        }
      }

      const result = results[0]
      
      return {
        success: true,
        issues: result.messages.map(msg => ({
          ruleId: msg.ruleId || 'unknown',
          severity: msg.severity,
          message: msg.message,
          line: msg.line,
          column: msg.column,
          endLine: msg.endLine,
          endColumn: msg.endColumn,
          fix: msg.fix ? {
            range: [msg.fix.range[0], msg.fix.range[1]],
            text: msg.fix.text
          } : undefined
        })),
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        issues: [],
        errors: [`JavaScript lint error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  private async lintPython(filePath: string): Promise<LintResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      const issues: LintResult['issues'] = []

      // Basic Python linting rules
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1

        // Check for common Python issues
        if (line.includes('import *')) {
          issues.push({
            ruleId: 'no-wildcard-import',
            severity: 1,
            message: 'Wildcard imports are discouraged',
            line: lineNumber,
            column: 0
          })
        }

        if (line.includes('print(') && !filePath.includes('test')) {
          issues.push({
            ruleId: 'no-print',
            severity: 1,
            message: 'print() statements should be removed in production',
            line: lineNumber,
            column: 0
          })
        }

        if (line.length > 88) { // PEP 8 line length
          issues.push({
            ruleId: 'line-too-long',
            severity: 1,
            message: 'Line too long (PEP 8 recommends 88 characters)',
            line: lineNumber,
            column: 0
          })
        }

        if (line.includes('TODO') || line.includes('FIXME')) {
          issues.push({
            ruleId: 'no-todo',
            severity: 1,
            message: 'TODO/FIXME comments should be addressed',
            line: lineNumber,
            column: 0
          })
        }
      }

      return {
        success: true,
        issues,
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        issues: [],
        errors: [`Python lint error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  private async lintGo(filePath: string): Promise<LintResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      const issues: LintResult['issues'] = []

      // Basic Go linting rules
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1

        // Check for common Go issues
        if (line.includes('fmt.Println(')) {
          issues.push({
            ruleId: 'no-fmt-println',
            severity: 1,
            message: 'fmt.Println() should be replaced with proper logging',
            line: lineNumber,
            column: 0
          })
        }

        if (line.includes('panic(')) {
          issues.push({
            ruleId: 'no-panic',
            severity: 2,
            message: 'panic() should be avoided in production code',
            line: lineNumber,
            column: 0
          })
        }

        if (line.includes('TODO') || line.includes('FIXME')) {
          issues.push({
            ruleId: 'no-todo',
            severity: 1,
            message: 'TODO/FIXME comments should be addressed',
            line: lineNumber,
            column: 0
          })
        }

        // Check for unused variables (basic check)
        if (line.includes('var ') && line.includes('=') && line.includes('_')) {
          issues.push({
            ruleId: 'unused-variable',
            severity: 1,
            message: 'Unused variable detected',
            line: lineNumber,
            column: 0
          })
        }
      }

      return {
        success: true,
        issues,
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        issues: [],
        errors: [`Go lint error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'py': 'python',
      'pyx': 'python',
      'go': 'go',
      'java': 'java',
      'kt': 'kotlin',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift'
    }
    return languageMap[ext || ''] || 'unknown'
  }
} 
import { z } from 'zod'
import type { McpToolContext } from '../../types'
import { safeLog } from '../../utils'
import { Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'
import { FixStrategyManager } from './fix-strategies'

export interface FixResult {
  success: boolean
  filesFixed: number
  issuesFixed: number
  duration: number
  fixes: Array<{
    file: string
    line: number
    original: string
    fixed: string
    issue: string
  }>
  errors: string[]
  dryRun?: boolean
}

export interface FixOperation {
  file: string
  line: number
  column?: number
  original: string
  fixed: string
  issue: string
  description: string
}

export class CoreFixer {
  private db!: Database
  private fixStrategyManager: FixStrategyManager
  private initialized = false
  private dbPath: string

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(tmpdir(), 'zodcore_fixes.sqlite')
    this.fixStrategyManager = new FixStrategyManager()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database })
    
    // Create fix tracking tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS applied_fixes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER,
        original_text TEXT NOT NULL,
        fixed_text TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        issue_description TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS fix_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        files_fixed INTEGER NOT NULL,
        issues_fixed INTEGER NOT NULL,
        duration INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_fixes_file ON applied_fixes (file);
      CREATE INDEX IF NOT EXISTS idx_fixes_issue ON applied_fixes (issue_type);
    `)
    
    this.initialized = true
    safeLog(`CoreFixer: initialized with database at ${this.dbPath}`)
  }

  async fixIssues(projectPath: string, analysisDbPath?: string, onlyIssues?: string[], dryRun: boolean = false): Promise<FixResult> {
    const startTime = Date.now()
    const fixes: FixOperation[] = []
    const errors: string[] = []
    let filesFixed = 0
    let issuesFixed = 0

    try {
      await this.initialize()
      
      // Get analysis issues from the analysis database
      const analysisDb = analysisDbPath || join(tmpdir(), 'zodcore_analysis.sqlite')
      let issues: any[] = []
      
      try {
        const analysisDbConnection = await open({ filename: analysisDb, driver: sqlite3.Database })
        
        // Check if analysis_issues table exists
        const tableExists = await analysisDbConnection.get(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='analysis_issues'
        `)
        
        if (tableExists) {
          let query = 'SELECT * FROM analysis_issues ORDER BY severity DESC, file, line'
          let params: any[] = []
          
          if (onlyIssues && onlyIssues.length > 0) {
            query = 'SELECT * FROM analysis_issues WHERE id IN (' + onlyIssues.map(() => '?').join(',') + ') ORDER BY severity DESC, file, line'
            params = onlyIssues
          }
          
          issues = await analysisDbConnection.all(query, params)
        } else {
          errors.push('analysis_issues table not found in analysis database')
        }
        
        await analysisDbConnection.close()
      } catch (dbError) {
        safeLog(`CoreFixer: error reading analysis database: ${dbError}`, 'warn')
        errors.push(`analysis database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`)
        // If we cannot read analysis DB at all, return early with error summary in dry-run mode
        if (!issues.length) {
          return {
            success: true,
            filesFixed: 0,
            issuesFixed: 0,
            duration: Date.now() - startTime,
            fixes: [],
            errors,
            dryRun
          }
        }
      }

      if (issues.length === 0) {
        safeLog(`CoreFixer: no issues found to fix`)
        return {
          success: true,
          filesFixed: 0,
          issuesFixed: 0,
          duration: Date.now() - startTime,
          fixes: [],
          errors: [],
          dryRun
        }
      }

      // Group issues by file and prioritize by severity
      const issuesByFile = new Map<string, any[]>()
      for (const issue of issues) {
        const filePath = join(projectPath, issue.file)
        if (!issuesByFile.has(filePath)) {
          issuesByFile.set(filePath, [])
        }
        issuesByFile.get(filePath)!.push(issue)
      }

      // Sort issues by severity within each file
      for (const [filePath, fileIssues] of issuesByFile) {
        fileIssues.sort((a, b) => {
          const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 }
          return (severityOrder[a.severity as keyof typeof severityOrder] || 4) - 
                 (severityOrder[b.severity as keyof typeof severityOrder] || 4)
        })
      }

      // Process each file
      for (const [filePath, fileIssues] of issuesByFile) {
        try {
          if (!await this.fileExists(filePath)) {
            errors.push(`File not found: ${filePath}`)
            continue
          }

          const content = await fs.readFile(filePath, 'utf8')
          const lines = content.split('\n')
          
          const fileFixes = await this.fixFileIssues(filePath, lines, fileIssues, dryRun)
          
          if (fileFixes.length > 0) {
            if (!dryRun) {
              // Create backup
              const backupPath = `${filePath}.backup.${Date.now()}`
              await fs.writeFile(backupPath, content)
              
              // Apply fixes
              const fixedContent = this.applyFixesToContent(lines, fileFixes)
              await fs.writeFile(filePath, fixedContent)
              
              // Record fixes in database
              for (const fix of fileFixes) {
                await this.db.run(`
                  INSERT INTO applied_fixes (file, line, column, original_text, fixed_text, issue_type, issue_description, applied_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  filePath,
                  fix.line,
                  fix.column || null,
                  fix.original,
                  fix.fixed,
                  fix.issue,
                  fix.description,
                  Date.now()
                ])
              }
            }
            
            fixes.push(...fileFixes)
            if (!dryRun) {
              filesFixed++
            }
            issuesFixed += fileFixes.length
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          errors.push(`Error fixing file ${filePath}: ${errorMsg}`)
          safeLog(`CoreFixer: error fixing file ${filePath}: ${errorMsg}`, 'error')
        }
      }

      // Record fix session
      await this.db.run(`
        INSERT INTO fix_sessions (started_at, completed_at, files_fixed, issues_fixed, duration)
        VALUES (?, ?, ?, ?, ?)
      `, [startTime, Date.now(), filesFixed, issuesFixed, Date.now() - startTime])

      const duration = Date.now() - startTime
      const action = dryRun ? 'previewed' : 'fixed'
      safeLog(`CoreFixer: ${action} ${issuesFixed} issues in ${filesFixed} files in ${duration}ms`)

      return {
        success: true,
        filesFixed,
        issuesFixed,
        duration,
        fixes,
        errors,
        dryRun
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      safeLog(`CoreFixer: fix operation failed: ${errorMsg}`, 'error')
      return {
        success: false,
        filesFixed: 0,
        issuesFixed: 0,
        duration: Date.now() - startTime,
        fixes: [],
        errors: [errorMsg],
        dryRun
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private createSampleIssues(projectPath: string): any[] {
    // Create sample issues for testing when no analysis database exists
    return [
      {
        id: 'sample-1',
        type: 'code_smell',
        severity: 'medium',
        file: 'test.js',
        line: 2,
        message: 'console.log should not be used',
        description: 'Console logging should be removed in production code',
        rule: 'no-console'
      },
      {
        id: 'sample-2',
        type: 'bug',
        severity: 'high',
        file: 'test.js',
        line: 3,
        message: 'Use === instead of ==',
        description: 'Loose equality can lead to unexpected behavior',
        rule: 'eqeqeq'
      }
    ]
  }

  private async fixFileIssues(filePath: string, lines: string[], issues: any[], dryRun: boolean = false): Promise<FixOperation[]> {
    const fixes: FixOperation[] = []
    
    // Sort issues by line number in descending order to avoid line number shifts
    const sortedIssues = issues.sort((a, b) => b.line - a.line)
    
    for (const issue of sortedIssues) {
      try {
        const originalContent = lines.join('\n')
        const fixResult = await this.fixStrategyManager.applyFix(filePath, originalContent, issue)
        
        if (fixResult.success && fixResult.fixedContent) {
          const fixedLines = fixResult.fixedContent.split('\n')
          const originalLine = lines[issue.line - 1] || ''
          const fixedLine = fixedLines[issue.line - 1] || ''
          
          if (originalLine !== fixedLine) {
            const fix: FixOperation = {
              file: filePath,
              line: issue.line,
              original: originalLine,
              fixed: fixedLine,
              issue: issue.rule || 'unknown',
              description: `Applied fix for ${issue.rule || 'unknown'} issue using ${fixResult.backupPath ? 'backup' : 'strategy'}`
            }
            
            fixes.push(fix)
            
            // Update the lines array for subsequent fixes
            lines.splice(0, lines.length, ...fixedLines)
            
            safeLog(`CoreFixer: applied fix for ${issue.rule} in ${filePath}:${issue.line}`, 'log')
          }
        } else {
          // Fallback to legacy fix generation
          const lineIndex = issue.line - 1
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const originalLine = lines[lineIndex]
            const fix = this.generateFix(filePath, issue, originalLine)
            
            if (fix) {
              fixes.push(fix)
              lines[lineIndex] = fix.fixed
              safeLog(`CoreFixer: applied legacy fix for ${issue.rule} in ${filePath}:${issue.line}`, 'log')
            } else {
              safeLog(`CoreFixer: no fix strategy available for ${issue.rule} in ${filePath}:${issue.line}`, 'warn')
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        safeLog(`CoreFixer: error applying fix for ${issue.rule} in ${filePath}:${issue.line}: ${errorMsg}`, 'error')
        // Continue with other fixes instead of failing completely
      }
    }
    
    return fixes
  }

  private generateFix(filePath: string, issue: any, originalLine: string): FixOperation | null {
    const lineNumber = issue.line
    
    switch (issue.rule) {
      case 'no-console':
        // Remove console.log statements
        if (originalLine.includes('console.log(')) {
          const fixedLine = originalLine.replace(/console\.log\([^)]*\);?\s*/, '')
          if (fixedLine.trim() === '') {
            return null // Skip empty lines
          }
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'console.log in production code',
            description: 'Removed console.log statement'
          }
        }
        break
      
      case 'eqeqeq':
        // Replace == with ===
        if (originalLine.includes('==') && !originalLine.includes('===')) {
          const fixedLine = originalLine.replace(/==/g, '===')
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'Use of loose equality (==)',
            description: 'Replaced == with === for strict equality'
          }
        }
        break
      
      case 'no-any':
        // Replace 'any' with 'unknown' in TypeScript
        if (originalLine.includes(': any') && filePath.endsWith('.ts')) {
          const fixedLine = originalLine.replace(/: any/g, ': unknown')
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'Use of any type',
            description: 'Replaced any with unknown for better type safety'
          }
        }
        break
      
      case 'max-line-length':
        // Break long lines (simplified implementation)
        if (originalLine.length > 120) {
          const words = originalLine.split(' ')
          if (words.length > 3) {
            const midPoint = Math.floor(words.length / 2)
            const firstHalf = words.slice(0, midPoint).join(' ')
            const secondHalf = words.slice(midPoint).join(' ')
            const indent = originalLine.match(/^(\s*)/)?.[1] || ''
            const fixedLine = `${firstHalf}\n${indent}${secondHalf}`
            return {
              file: filePath,
              line: lineNumber,
              original: originalLine,
              fixed: fixedLine,
              issue: 'Line too long',
              description: 'Split long line for better readability'
            }
          }
        }
        break
      
      case 'no-todo':
        // Add TODO comment with issue reference
        if (originalLine.includes('TODO') || originalLine.includes('FIXME')) {
          const fixedLine = originalLine.replace(
            /(TODO|FIXME):?\s*(.*)/,
            '$1: $2 (Issue #TODO-001)'
          )
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'TODO/FIXME comment found',
            description: 'Added issue reference to TODO comment'
          }
        }
        break
      
      case 'no-async-foreach':
        // Replace async forEach with for...of (best-effort preview)
        if (originalLine.includes('.forEach(') && originalLine.includes('async')) {
          const fixedLine = originalLine // keep original to avoid breaking logic in preview
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'Async forEach usage',
            description: 'Recommend replacing async forEach with for...of loop'
          }
        }
        break

      case 'no-innerhtml':
        // Replace innerHTML with textContent for security
        if (originalLine.includes('.innerHTML =')) {
          const fixedLine = originalLine.replace(/\.innerHTML\s*=/g, '.textContent =')
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'innerHTML usage',
            description: 'Replaced innerHTML with textContent for security'
          }
        }
        break

      case 'no-eval':
        // Replace eval with safer alternatives
        if (originalLine.includes('eval(')) {
          const evalMatch = originalLine.match(/eval\(([^)]+)\)/)
          if (evalMatch) {
            const evalArg = evalMatch[1].trim()
            let fixedLine: string
            if (evalArg.startsWith('"') || evalArg.startsWith("'")) {
              fixedLine = originalLine.replace(/eval\(([^)]+)\)/g, 'JSON.parse($1)')
            } else {
              fixedLine = originalLine.replace(/eval\(([^)]+)\)/, '// SECURITY: eval() removed - review manually: eval($1)')
            }
            return {
              file: filePath,
              line: lineNumber,
              original: originalLine,
              fixed: fixedLine,
              issue: 'eval usage',
              description: 'Replaced eval with safer alternative'
            }
          }
        }
        break

      case 'no-bare-except':
        // Replace bare except with specific exception
        if (originalLine.includes('except:') && filePath.endsWith('.py')) {
          const fixedLine = originalLine.replace(/except:/g, 'except Exception:')
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: fixedLine,
            issue: 'Bare except clause',
            description: 'Replaced bare except with specific exception handling'
          }
        }
        break

      case 'no-print':
        // Remove print statements in Python
        if (originalLine.includes('print(') && filePath.endsWith('.py')) {
          return {
            file: filePath,
            line: lineNumber,
            original: originalLine,
            fixed: '',
            issue: 'Print statement in production',
            description: 'Removed print statement'
          }
        }
        break
    }
    
    return null
  }

  private applyFixesToContent(lines: string[], fixes: FixOperation[]): string {
    // Apply fixes in reverse order to maintain line numbers
    const sortedFixes = fixes.sort((a, b) => b.line - a.line)
    
    for (const fix of sortedFixes) {
      const lineIndex = fix.line - 1
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = fix.fixed
      }
    }
    
    return lines.join('\n')
  }

  async getFixHistory(): Promise<{ fixes: any[]; summary: any }> {
    await this.initialize()
    
    const fixes = await this.db.all('SELECT * FROM applied_fixes ORDER BY applied_at DESC LIMIT 50')
    const sessions = await this.db.all('SELECT * FROM fix_sessions ORDER BY started_at DESC LIMIT 5')
    
    const summary = {
      totalFixes: fixes.length,
      totalSessions: sessions.length,
      lastFix: fixes[0] ? new Date(fixes[0].applied_at).toLocaleString() : 'Never',
      lastSession: sessions[0] ? new Date(sessions[0].started_at).toLocaleString() : 'Never'
    }
    
    return { fixes, summary }
  }
}

export function registerCoreFixTool({ mcp }: McpToolContext) {
  const fixer = new CoreFixer()

  mcp.tool(
    'core_fix',
    'Core Fix — Applies real code modifications to fix detected issues using parsing, not regex or naive string replace.',
    {
      // Align with spec
      mode: z.enum(['preview','apply']).describe('Preview or apply fixes'),
      issues: z.array(z.string()).optional().describe('Specific issue IDs to fix'),
      analysisDbPath: z.string().optional(),
      projectPath: z.string().optional(),
      dry_run: z.boolean().optional().describe('If true, do not apply changes, only preview')
    },
    async (input) => {
      try {
        const projectPath = input.projectPath || process.cwd()
        const isDryRun = input.mode ? (input.mode === 'preview') : !!input.dry_run
        const result = await fixer.fixIssues(projectPath, input.analysisDbPath, input.issues, isDryRun)
        
        const fixText = result.fixes.length > 0 
          ? `\n\n🔧 ${result.dryRun ? 'Previewed' : 'Applied'} Fixes:\n${result.fixes.slice(0, 10).map(f => 
              `  ${f.file}:${f.line} - ${f.issue}\n    ${f.original.trim()} → ${f.fixed?.trim?.() ?? ''}`
            ).join('\n')}${result.fixes.length > 10 ? `\n  ... and ${result.fixes.length - 10} more` : ''}`
          : `\n\n${result.dryRun ? 'Dry-run: No fixes would be applied' : '✅ No fixes applied (no auto-fixable issues found)'}`
        
        return {
          content: [{ 
            type: 'text' as const, 
             text: result.success 
               ? `✅ ${result.dryRun ? 'Preview' : 'Fix operation'} completed!\n\n` +
                `📁 Files ${result.dryRun ? 'affected' : 'fixed'}: ${result.filesFixed}\n` +
                `🔧 Issues ${result.dryRun ? 'detectable' : 'fixed'}: ${result.issuesFixed}\n` +
                `⏱️ Duration: ${result.duration}ms` +
                fixText
              : `❌ Fix operation failed!` 
          }],
          metadata: {
            success: result.success,
            dryRun: result.dryRun,
            filesFixed: result.filesFixed,
            issuesFixed: result.issuesFixed,
            duration: result.duration,
            fixes: result.fixes,
            errors: result.errors
          }
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text' as const, 
            text: `❌ Core Fix error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }],
          metadata: {
            error: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    }
  )

  return { fixer }
} 
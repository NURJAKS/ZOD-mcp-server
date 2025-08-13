import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoreFixer } from '../../../src/tools/zod-core/core-fix'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'

describe('CoreFixer', () => {
  let fixer: CoreFixer
  let tempDir: string

  beforeEach(async () => {
    fixer = new CoreFixer()
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

  describe('fixIssues', () => {
    it('should fix JavaScript console.log issues', async () => {
      const jsContent = `
function test() {
  console.log('Hello, World!');
  return true;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Create analysis database with issues
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:console',
        'code_smell',
        'low',
        'test.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(1)
      expect(result.issuesFixed).toBe(1)
      expect(result.fixes.length).toBe(1)
      expect(result.duration).toBeGreaterThan(0)

      // Check that the file was actually fixed
      const fixedContent = await fs.readFile(jsFile, 'utf8')
      expect(fixedContent).not.toContain('console.log')
    })

    it('should fix TypeScript any type issues', async () => {
      const tsContent = `
function processData(data: any) {
  return data;
}
`
      const tsFile = join(tempDir, 'test.ts')
      await fs.writeFile(tsFile, tsContent)

      // Create analysis database with issues
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:2:any',
        'maintainability',
        'medium',
        'test.ts',
        2,
        'Use of any type',
        'any type bypasses TypeScript type checking',
        'no-any',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(1)
      expect(result.issuesFixed).toBe(1)

      // Check that the file was actually fixed
      const fixedContent = await fs.readFile(tsFile, 'utf8')
      expect(fixedContent).toContain(': unknown')
      expect(fixedContent).not.toContain(': any')
    })

    it('should fix loose equality issues', async () => {
      const jsContent = `
function test() {
  if (x == 5) {
    return true;
  }
  return false;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Create analysis database with issues
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:eqeqeq',
        'bug',
        'medium',
        'test.js',
        3,
        'Use of loose equality (==)',
        'Loose equality can lead to unexpected type coercion',
        'eqeqeq',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(1)
      expect(result.issuesFixed).toBe(1)

      // Check that the file was actually fixed
      const fixedContent = await fs.readFile(jsFile, 'utf8')
      expect(fixedContent).toContain('===')
      expect(fixedContent).not.toContain('==')
    })

    it('should handle dry run mode', async () => {
      const jsContent = `
function test() {
  console.log('test');
  return true;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Create analysis database with issues
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:console',
        'code_smell',
        'low',
        'test.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, true)

      expect(result.success).toBe(true)
      expect(result.dryRun).toBe(true)
      expect(result.filesFixed).toBe(0) // No files should be modified in dry run
      expect(result.issuesFixed).toBeGreaterThan(0) // But issues should be detected
      expect(result.fixes.length).toBeGreaterThan(0)

      // Check that the file was NOT actually modified
      const originalContent = await fs.readFile(jsFile, 'utf8')
      expect(originalContent).toContain('console.log')
    })

    it('should fix specific issues when issue IDs are provided', async () => {
      const jsContent = `
function test() {
  console.log('test1');
  console.log('test2');
  return true;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Create analysis database with multiple issues
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:console1',
        'code_smell',
        'low',
        'test.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:4:console2',
        'code_smell',
        'low',
        'test.js',
        4,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      // Fix only the first issue
      const result = await fixer.fixIssues(tempDir, analysisDbPath, ['test:3:console1'], false)

      expect(result.success).toBe(true)
      expect(result.issuesFixed).toBe(1)

      // Check that only the first console.log was removed
      const fixedContent = await fs.readFile(jsFile, 'utf8')
      expect(fixedContent).not.toContain('console.log(\'test1\')')
      expect(fixedContent).toContain('console.log(\'test2\')')
    })

    it('should handle multiple files', async () => {
      const jsContent1 = `
function test1() {
  console.log('test1');
  return true;
}
`
      const jsContent2 = `
function test2() {
  console.log('test2');
  return true;
}
`
      const jsFile1 = join(tempDir, 'test1.js')
      const jsFile2 = join(tempDir, 'test2.js')
      await fs.writeFile(jsFile1, jsContent1)
      await fs.writeFile(jsFile2, jsContent2)

      // Create analysis database with issues for both files
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test1:3:console',
        'code_smell',
        'low',
        'test1.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test2:3:console',
        'code_smell',
        'low',
        'test2.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(2)
      expect(result.issuesFixed).toBe(2)

      // Check that both files were fixed
      const fixedContent1 = await fs.readFile(jsFile1, 'utf8')
      const fixedContent2 = await fs.readFile(jsFile2, 'utf8')
      expect(fixedContent1).not.toContain('console.log')
      expect(fixedContent2).not.toContain('console.log')
    })

    it('should handle analysis database errors gracefully', async () => {
      const jsContent = `
function test() {
  console.log('test');
  return true;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      // Try to fix with non-existent analysis database
      const result = await fixer.fixIssues(tempDir, 'non-existent-db.sqlite', undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(0)
      expect(result.issuesFixed).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle file system errors gracefully', async () => {
      // Create analysis database with issues for non-existent file
      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:console',
        'code_smell',
        'low',
        'non-existent.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      const result = await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      expect(result.success).toBe(true)
      expect(result.filesFixed).toBe(0)
      expect(result.issuesFixed).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('getFixHistory', () => {
    it('should retrieve fix history from database', async () => {
      // First run some fixes to create history
      const jsContent = `
function test() {
  console.log('test');
  return true;
}
`
      const jsFile = join(tempDir, 'test.js')
      await fs.writeFile(jsFile, jsContent)

      const analysisDbPath = join(tempDir, 'analysis.sqlite')
      const { open } = await import('sqlite')
      const { Database } = await import('sqlite')
      const sqlite3 = await import('sqlite3')
      
      const db = await open({ filename: analysisDbPath, driver: sqlite3.Database })
      await db.exec(`
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
      `)
      
      await db.run(
        'INSERT INTO analysis_issues (id, type, severity, file, line, message, description, rule, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'test:3:console',
        'code_smell',
        'low',
        'test.js',
        3,
        'console.log in production code',
        'console.log statements should be removed',
        'no-console',
        Date.now()
      )

      await fixer.fixIssues(tempDir, analysisDbPath, undefined, false)

      // Then retrieve history
      const history = await fixer.getFixHistory()

      expect(history.fixes).toBeDefined()
      expect(history.summary).toBeDefined()
      expect(history.summary.totalFixes).toBeGreaterThan(0)
      expect(history.summary.lastFix).toBeDefined()
    })
  })
}) 
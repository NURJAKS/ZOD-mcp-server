#!/usr/bin/env node
import { defineCommand, runMain as _runMain } from 'citty'
import { explain } from './core'
import { CoreIndexer } from './core-index'
import { CoreAnalyzer } from './core-analyze'
import { CoreFixer } from './core-fix'
import { CoreSearcher } from './core-search'
import { CoreStatusChecker } from './core-status'

const cli = defineCommand({
  meta: { name: 'zod-core', version: '0.1.0', description: 'ZOD Core CLI - Project intelligence and analysis' },
  subCommands: {
         explain: defineCommand({
       meta: { description: 'Explain code and concepts' },
       args: {
         query: { type: 'string', description: 'Query to explain' },
         projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
         session: { type: 'string', description: 'Session id', default: 'cli-session' },
       },
       async run({ args }) {
         const query = args.query || args._?.[0]
         if (!query) {
           console.error('Query is required. Usage: zod-core explain "your query"')
           process.exit(1)
         }
         const res = await explain(
           String(query),
           { projectPath: String(args.projectPath), sessionId: String(args.session) }
         )
         console.log(JSON.stringify(res, null, 2))
       },
     }),
    
    index: defineCommand({
      meta: { description: 'Index project structure' },
      args: {
        action: { type: 'string', description: 'Action to perform', default: 'index' },
        projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
        databasePath: { type: 'string', description: 'Database path' },
      },
      async run({ args }) {
        const indexer = new CoreIndexer(args.databasePath)
        if (args.action === 'index') {
          const result = await indexer.indexProject(String(args.projectPath))
          console.log(JSON.stringify(result, null, 2))
        } else {
          const structure = await indexer.getProjectStructure()
          console.log(JSON.stringify(structure, null, 2))
        }
      },
    }),
    
    analyze: defineCommand({
      meta: { description: 'Analyze code for issues' },
      args: {
        action: { type: 'string', description: 'Action to perform', default: 'analyze' },
        projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
        databasePath: { type: 'string', description: 'Database path' },
      },
      async run({ args }) {
        const analyzer = new CoreAnalyzer(args.databasePath)
        if (args.action === 'analyze') {
          const result = await analyzer.analyzeProject(String(args.projectPath))
          console.log(JSON.stringify(result, null, 2))
        } else {
          const { issues, summary } = await analyzer.getAnalysisResults()
          console.log(JSON.stringify({ issues, summary }, null, 2))
        }
      },
    }),
    
    fix: defineCommand({
      meta: { description: 'Fix detected issues' },
      args: {
        action: { type: 'string', description: 'Action to perform', default: 'fix' },
        projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
        analysisDbPath: { type: 'string', description: 'Analysis database path' },
        databasePath: { type: 'string', description: 'Database path' },
      },
      async run({ args }) {
        const fixer = new CoreFixer(args.databasePath)
        if (args.action === 'fix') {
          const result = await fixer.fixIssues(String(args.projectPath), args.analysisDbPath)
          console.log(JSON.stringify(result, null, 2))
        } else {
          const { fixes, summary } = await fixer.getFixHistory()
          console.log(JSON.stringify({ fixes, summary }, null, 2))
        }
      },
    }),
    
    search: defineCommand({
      meta: { description: 'Search indexed project' },
      args: {
        action: { type: 'string', description: 'Action to perform', default: 'search' },
        query: { type: 'string', description: 'Search query' },
        type: { type: 'string', description: 'Search type', default: 'exact' },
        file: { type: 'string', description: 'File filter' },
        language: { type: 'string', description: 'Language filter' },
        limit: { type: 'number', description: 'Result limit', default: 20 },
        caseSensitive: { type: 'boolean', description: 'Case sensitive search' },
        projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
        databasePath: { type: 'string', description: 'Database path' },
      },
             async run({ args }) {
         const searcher = new CoreSearcher(args.databasePath)
         if (args.action === 'search') {
           const query = args.query || args._?.[0]
           if (!query) {
             console.error('Query is required for search action. Usage: zod-core search "your query"')
             process.exit(1)
           }
           const results = await searcher.search({
             query: String(query),
             type: args.type as any,
             file: args.file,
             language: args.language,
             limit: args.limit,
             caseSensitive: args.caseSensitive || false
           })
           console.log(JSON.stringify(results, null, 2))
         } else if (args.action === 'index') {
           const result = await searcher.buildSearchIndex(String(args.projectPath))
           console.log(JSON.stringify(result, null, 2))
         } else {
           const { queries, summary } = await searcher.getSearchHistory()
           console.log(JSON.stringify({ queries, summary }, null, 2))
         }
       },
    }),
    
    status: defineCommand({
      meta: { description: 'Show system status' },
      args: {
        action: { type: 'string', description: 'Action to perform', default: 'status' },
        projectPath: { type: 'string', description: 'Project path', default: process.cwd() },
      },
      async run({ args }) {
        const statusChecker = new CoreStatusChecker()
        if (args.action === 'detailed') {
          const { status, recommendations } = await statusChecker.getDetailedStatus(String(args.projectPath))
          console.log(JSON.stringify({ status, recommendations }, null, 2))
        } else {
          const status = await statusChecker.getSystemStatus(String(args.projectPath))
          console.log(JSON.stringify(status, null, 2))
        }
      },
    }),
  },
  args: {
    query: { type: 'string', description: 'User query (legacy support)' },
    context: { type: 'string', description: 'Project path (legacy support)' },
    intent: { type: 'string', description: 'Intent (legacy support)' },
    session: { type: 'string', description: 'Session id (legacy support)', default: 'cli-session' },
  },
  async run({ args }) {
    // Legacy support for direct query
    if (args.query) {
      const res = await explain(
        String(args.query),
        { projectPath: args.context ? String(args.context) : process.cwd(), sessionId: String(args.session) }
    )
    console.log(JSON.stringify(res, null, 2))
    } else {
      console.log('ZOD Core CLI - Project intelligence and analysis')
      console.log('')
      console.log('Available commands:')
      console.log('  zod-core explain <query>     - Explain code and concepts')
      console.log('  zod-core index               - Index project structure')
      console.log('  zod-core analyze             - Analyze code for issues')
      console.log('  zod-core fix                 - Fix detected issues')
      console.log('  zod-core search <query>      - Search indexed project')
      console.log('  zod-core status              - Show system status')
      console.log('')
      console.log('Examples:')
      console.log('  zod-core explain "What does this function do?"')
      console.log('  zod-core index')
      console.log('  zod-core analyze')
      console.log('  zod-core fix')
      console.log('  zod-core search "authentication"')
      console.log('  zod-core status')
    }
  },
})

export const runMain = () => _runMain(cli)

if (import.meta.url === `file://${process.argv[1]}`) runMain()


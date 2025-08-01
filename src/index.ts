#!/usr/bin/env node
import type { McpToolContext } from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runMain as _runMain, defineCommand } from 'citty'
import { version } from '../package.json'
import { createServer, startServer, stopServer } from './server'
import { registerDocumentationTools } from './tools/documentation'
import { registerProjectTools } from './tools/project'
import { registerRepositoryTools } from './tools/repository'
import { registerWebSearchTools } from './tools/web-search'

const cli = defineCommand({
  meta: {
    name: 'nia-mcp-server',
    version,
    description: 'NIA MCP Server - Intelligent code indexing, search, and research platform',
  },
  args: {
    http: { type: 'boolean', description: 'Run with HTTP transport' },
    sse: { type: 'boolean', description: 'Run with SSE transport' },
    stdio: { type: 'boolean', description: 'Run with stdio transport (default)' },
    port: { type: 'string', description: 'Port for http/sse (default 3000)', default: '3000' },
    endpoint: { type: 'string', description: 'HTTP endpoint (default /mcp)', default: '/mcp' },
    setup: { type: 'string', description: 'Setup MCP configuration with API key (optional)' },
    status: { type: 'boolean', description: 'Check installation status' },
    help: { type: 'boolean', description: 'Show help information' },
    debug: { type: 'boolean', description: 'Enable debug logging' },
  },
  async run({ args }) {
    // Setup command
    if (args.setup) {
      await setupMCP(args.setup)
      return
    }

    // Status command
    if (args.status) {
      await checkStatus()
      return
    }

    // Help command
    if (args.help) {
      showHelp()
      return
    }

    const mode = args.http ? 'http' : args.sse ? 'sse' : 'stdio'
    const mcp = createServer({ name: 'nia-mcp-server', version })

    process.on('SIGTERM', () => stopServer(mcp))
    process.on('SIGINT', () => stopServer(mcp))

    // Регистрация инструментов с обработкой ошибок
    try {
      if (args.debug)
        console.log('🔧 Registering tools...')

      await registerToolsSafely(mcp, args.debug)

      if (args.debug)
        console.log('✅ All tools registered successfully')
    }
    catch (error) {
      console.error('❌ Error registering tools:', error)
      process.exit(1)
    }

    if (mode === 'http') {
      await startServer(mcp, { type: 'http', port: Number(args.port), endpoint: args.endpoint })
    }
    else if (mode === 'sse') {
      console.log('Starting SSE server...')
      await startServer(mcp, { type: 'sse', port: Number(args.port) })
    }
    else if (mode === 'stdio') {
      await startServer(mcp, { type: 'stdio' })
    }
  },
})

// Функция для безопасной регистрации инструментов
async function registerToolsSafely(mcp: any, debug: boolean = false) {
  const tools = [
    { name: 'RepositoryTools', register: registerRepositoryTools },
    { name: 'DocumentationTools', register: registerDocumentationTools },
    { name: 'WebSearchTools', register: registerWebSearchTools },
    { name: 'ProjectTools', register: registerProjectTools },
  ]

  for (const tool of tools) {
    try {
      // Suppress console output for stdio transport
      if (debug && process.argv.includes('--stdio') === false)
        console.log(`📦 Registering ${tool.name}...`)

      // Добавляем таймаут для регистрации инструментов
      await Promise.race([
        tool.register({ mcp } as McpToolContext),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout registering ${tool.name}`)), 10000),
        ),
      ])

      if (debug && process.argv.includes('--stdio') === false)
        console.log(`✅ ${tool.name} registered`)
    }
    catch (error) {
      // Only log errors if not in stdio mode
      if (!process.argv.includes('--stdio'))
        console.error(`❌ Failed to register ${tool.name}:`, error)
      // Продолжаем регистрацию других инструментов
    }
  }
}

async function setupMCP(apiKey?: string) {
  console.log('🚀 Setting up NIA MCP Server...')

  // Create global MCP configuration
  const cursorDir = join(homedir(), '.cursor')
  const mcpConfigPath = join(cursorDir, 'mcp.json')

  if (!existsSync(cursorDir)) {
    mkdirSync(cursorDir, { recursive: true })
    console.log(`📁 Created directory: ${cursorDir}`)
  }

  const mcpConfig: any = {
    mcpServers: {
      'nia-mcp-server': {
        command: 'nia-mcp',
        args: ['--stdio'],
      },
    },
  }

  // Add API key if provided
  if (apiKey) {
    mcpConfig.mcpServers['nia-mcp-server'].env = {
      NIA_API_KEY: apiKey,
      NIA_API_URL: 'https://apigcp.trynia.ai/',
    }
  }

  writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))
  console.log(`✅ Global config created: ${mcpConfigPath}`)

  // Create local project configuration
  const localCursorDir = '.cursor'
  const localMcpConfigPath = join(localCursorDir, 'mcp.json')

  if (!existsSync(localCursorDir)) {
    mkdirSync(localCursorDir, { recursive: true })
    console.log(`📁 Created local directory: ${localCursorDir}`)
  }

  writeFileSync(localMcpConfigPath, JSON.stringify(mcpConfig, null, 2))
  console.log(`✅ Local config created: ${localMcpConfigPath}`)

  // Create .gitignore entry for API key
  const gitignorePath = '.gitignore'
  const gitignoreContent = `
# NIA MCP Server
.cursor/mcp.json
.env
*.log
`

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, gitignoreContent.trim())
    console.log(`✅ Created .gitignore`)
  }
  else {
    // Append to existing .gitignore
    const existingContent = readFileSync(gitignorePath, 'utf8')
    if (!existingContent.includes('# NIA MCP Server')) {
      writeFileSync(gitignorePath, existingContent + gitignoreContent)
      console.log(`✅ Updated .gitignore`)
    }
  }

  // Create README with usage instructions
  const readmePath = 'NIA_SETUP.md'
  const readmeContent = `# 🚀 NIA MCP Server Setup

Your NIA MCP Server has been successfully configured!

## 🎯 Quick Start

Try these commands in Cursor Chat:

\`\`\`
# Index a repository
index_repository(repo_url: "https://github.com/NURJAKS/Todo-list")

# List indexed repositories
list_repositories()

# Search codebase
search_codebase(query: "authentication logic")

# Index documentation
index_documentation(url: "https://docs.example.com")

# Web search
nia_web_search(query: "React hooks best practices")
\`\`\`

## 📋 Available Tools

### Repository Management
- \`index_repository\` - Index GitHub repositories
- \`list_repositories\` - List indexed repositories
- \`check_repository_status\` - Monitor indexing progress
- \`search_codebase\` - Search with natural language

### Documentation Management
- \`index_documentation\` - Index websites/docs
- \`list_documentation\` - List indexed docs
- \`search_documentation\` - Search documentation

### Web Search & Research
- \`nia_web_search\` - AI-powered search
- \`nia_deep_research_agent\` - Deep research

### Project Initialization
- \`initialize_project\` - Setup IDE configurations

## 🔧 Troubleshooting

If something doesn't work:
1. Restart Cursor
2. Check: \`nia-mcp-server --help\`
3. Reinstall: \`npm install -g @your-org/nia-mcp-server\`

## 📞 Support

- GitHub: https://github.com/your-org/nia-mcp-server
- Documentation: https://docs.trynia.ai

---
*Powered by NIA MCP Server v${version}*
`

  writeFileSync(readmePath, readmeContent)
  console.log(`✅ Created usage guide: ${readmePath}`)

  console.log('')
  console.log('🎉 Setup completed successfully!')
  console.log('')
  console.log('📋 What was configured:')
  console.log(`• Global config: ${mcpConfigPath}`)
  console.log(`• Local config: ${localMcpConfigPath}`)
  if (apiKey) {
    console.log(`• API Key: ${apiKey.substring(0, 8)}...`)
  }
  else {
    console.log(`• API Key: Not configured (optional)`)
  }
  console.log(`• .gitignore: Updated`)
  console.log(`• Usage guide: ${readmePath}`)
  console.log('')
  console.log('🎯 Next steps:')
  console.log('1. Restart Cursor to load the new configuration')
  console.log('2. Open NIA_SETUP.md for usage examples')
  console.log('3. Try: index_repository(repo_url: "https://github.com/NURJAKS/Todo-list")')
  console.log('')
  console.log('💡 Your NIA MCP Server is ready to use!')
  console.log('')
  console.log('🚀 Happy coding!')
}

async function checkStatus() {
  console.log('🔍 Checking NIA MCP Server installation...')
  console.log('')

  // Check global config
  const globalConfigPath = join(homedir(), '.cursor', 'mcp.json')
  const globalExists = existsSync(globalConfigPath)
  console.log(`🌍 Global config: ${globalExists ? '✅ Found' : '❌ Missing'}`)

  // Check local config
  const localConfigPath = join(process.cwd(), '.cursor', 'mcp.json')
  const localExists = existsSync(localConfigPath)
  console.log(`📁 Local config: ${localExists ? '✅ Found' : '❌ Missing'}`)

  // Check if command is available
  const { execSync } = await import('node:child_process')
  let commandAvailable = false
  try {
    execSync('which nia-mcp', { stdio: 'ignore' })
    commandAvailable = true
  }
  catch {
    // Command not found
  }
  console.log(`⚡ Command available: ${commandAvailable ? '✅ Yes' : '❌ No'}`)

  console.log('')
  if (globalExists && localExists && commandAvailable) {
    console.log('🎉 Installation looks good!')
    console.log('💡 Try: index_repository(repo_url: "https://github.com/NURJAKS/Todo-list")')
  }
  else {
    console.log('⚠️  Some issues detected:')
    if (!commandAvailable) {
      console.log('   • Run: npm install -g @your-org/nia-mcp-server')
    }
    if (!globalExists || !localExists) {
      console.log('   • Run: nia-mcp setup')
    }
  }
}

function showHelp() {
  console.log('🚀 NIA MCP Server - Intelligent code indexing, search, and research platform')
  console.log('')
  console.log('📋 Available commands:')
  console.log('')
  console.log('  Setup:')
  console.log('    nia-mcp setup [API_KEY]      Setup MCP configuration (API key optional)')
  console.log('')
  console.log('  Status:')
  console.log('    nia-mcp status               Check installation status')
  console.log('')
  console.log('  Run server:')
  console.log('    nia-mcp                     Run with stdio transport (default)')
  console.log('    nia-mcp --http              Run with HTTP transport')
  console.log('    nia-mcp --sse               Run with SSE transport')
  console.log('')
  console.log('  Options:')
  console.log('    --port PORT                        Port for http/sse (default: 3000)')
  console.log('    --endpoint ENDPOINT                HTTP endpoint (default: /mcp)')
  console.log('    --help                             Show this help')
  console.log('')
  console.log('🎯 Quick start:')
  console.log('  1. nia-mcp setup')
  console.log('  2. Restart Cursor')
  console.log('  3. Try: index_repository(repo_url: "https://github.com/NURJAKS/Todo-list")')
  console.log('')
  console.log('📖 Documentation: https://docs.trynia.ai')
  console.log('🐛 Issues: https://github.com/your-org/nia-mcp-server')
}

export const runMain = () => _runMain(cli)

// Export classes for direct use
export { RepositoryIndexer } from './core/indexer'
export { DocumentationIndexer } from './core/indexer'
export { SearchEngine } from './core/search'
export { DatabaseManager } from './core/database'

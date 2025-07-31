import type { McpToolContext } from '../types'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'

const SUPPORTED_PROFILES = [
    'cursor', 'vscode', 'claude', 'windsurf', 'cline',
    'codex', 'zed', 'jetbrains', 'neovim', 'sublime'
] as const

type SupportedProfile = typeof SUPPORTED_PROFILES[number]

interface IDEConfig {
    name: string
    configFiles: string[]
    template: string
}

const IDE_CONFIGS: Record<SupportedProfile, IDEConfig> = {
    cursor: {
        name: 'Cursor',
        configFiles: ['.cursor/mcp.json', '.cursorrules'],
        template: `{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": ["./bin/cli.mjs", "--stdio"]
    }
  }
}`
    },
    vscode: {
        name: 'VS Code',
        configFiles: ['.vscode/settings.json', '.vscode/extensions.json'],
        template: `{
  "files.associations": {
    "*.mcp": "json"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}`
    },
    claude: {
        name: 'Claude',
        configFiles: ['.claude/config.json'],
        template: `{
  "mcp": {
    "servers": {
      "nia-mcp-server": {
        "command": "node",
        "args": ["./bin/cli.mjs", "--stdio"]
      }
    }
  }
}`
    },
    windsurf: {
        name: 'Windsurf',
        configFiles: ['.windsurf/config.json'],
        template: `{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": ["./bin/cli.mjs", "--stdio"]
    }
  }
}`
    },
    cline: {
        name: 'Cline',
        configFiles: ['.cline/config.json'],
        template: `{
  "mcp": {
    "servers": {
      "nia-mcp-server": {
        "command": "node",
        "args": ["./bin/cli.mjs", "--stdio"]
      }
    }
  }
}`
    },
    codex: {
        name: 'Codex',
        configFiles: ['.codex/config.json'],
        template: `{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": ["./bin/cli.mjs", "--stdio"]
    }
  }
}`
    },
    zed: {
        name: 'Zed',
        configFiles: ['.zed/settings.json'],
        template: `{
  "mcp": {
    "servers": {
      "nia-mcp-server": {
        "command": "node",
        "args": ["./bin/cli.mjs", "--stdio"]
      }
    }
  }
}`
    },
    jetbrains: {
        name: 'JetBrains',
        configFiles: ['.idea/misc.xml', '.idea/modules.xml'],
        template: `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectRootManager" version="2" languageLevel="JDK_17" default="true" project-jdk-name="17" project-jdk-type="JavaSDK">
    <output url="file://$PROJECT_DIR$/out" />
  </component>
</project>`
    },
    neovim: {
        name: 'Neovim',
        configFiles: ['.nvim/init.lua'],
        template: `-- Neovim configuration for NIA MCP Server
vim.g.mcp_servers = {
  nia_mcp_server = {
    command = "node",
    args = { "./bin/cli.mjs", "--stdio" }
  }
}`
    },
    sublime: {
        name: 'Sublime Text',
        configFiles: ['.sublime-project'],
        template: `{
  "folders": [
    {
      "path": "."
    }
  ],
  "settings": {
    "mcp_servers": {
      "nia-mcp-server": {
        "command": "node",
        "args": ["./bin/cli.mjs", "--stdio"]
      }
    }
  }
}`
    }
}

export function registerProjectTools({ mcp }: McpToolContext): void {
    // initialize_project - Set up NIA-enabled projects with IDE configs
    mcp.tool(
        'initialize_project',
        'Initialize a NIA-enabled project with IDE-specific rules and configurations',
        {
            project_root: z.string().describe('Absolute path to the project root directory'),
            profiles: z.array(z.enum(SUPPORTED_PROFILES)).default(['cursor']).describe('List of IDE profiles to set up'),
        },
        async ({ project_root, profiles }) => {
            try {
                // Проверяем существование директории
                if (!fs.existsSync(project_root)) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Project directory does not exist: ${project_root}\n\nPlease provide a valid absolute path to your project directory.`
                        }],
                    }
                }

                const results: string[] = []
                const createdFiles: string[] = []

                // Создаем конфигурации для каждого профиля
                for (const profile of profiles) {
                    const config = IDE_CONFIGS[profile]
                    results.push(`📝 Setting up ${config.name} configuration...`)

                    for (const configFile of config.configFiles) {
                        const fullPath = path.join(project_root, configFile)
                        const configDir = path.dirname(fullPath)

                        // Создаем директорию если нужно
                        if (!fs.existsSync(configDir)) {
                            fs.mkdirSync(configDir, { recursive: true })
                            results.push(`  📁 Created directory: ${configDir}`)
                        }

                        // Создаем файл конфигурации
                        fs.writeFileSync(fullPath, config.template)
                        createdFiles.push(configFile)
                        results.push(`  ✅ Created: ${configFile}`)
                    }
                }

                // Создаем README с инструкциями
                const readmePath = path.join(project_root, 'NIA_SETUP.md')
                const readmeContent = `# NIA MCP Server Setup

This project has been configured with NIA MCP Server support for the following IDEs:

${profiles.map(profile => `- ${IDE_CONFIGS[profile].name}`).join('\n')}

## Configuration Files Created:

${createdFiles.map(file => `- \`${file}\``).join('\n')}

## Next Steps:

1. **Install NIA MCP Server:**
   \`\`\`bash
   npm install -g @your-org/nia-mcp-server
   \`\`\`

2. **Start the MCP Server:**
   \`\`\`bash
   nia-mcp-server --stdio
   \`\`\`

3. **Test the Integration:**
   - Open your IDE
   - Try using NIA tools like \`index_repository\`, \`search_codebase\`, etc.

## Available Tools:

### Repository Management:
- \`index_repository\` - Index GitHub repositories
- \`list_repositories\` - List indexed repositories
- \`search_codebase\` - Search code with natural language

### Documentation Management:
- \`index_documentation\` - Index documentation sites
- \`search_documentation\` - Search documentation

### Web Search & Research:
- \`nia_web_search\` - AI-powered web search
- \`nia_deep_research_agent\` - Deep research analysis

### Project Management:
- \`initialize_project\` - Set up new NIA-enabled projects

## Support:

For more information, visit: https://github.com/your-org/nia-mcp-server
`

                fs.writeFileSync(readmePath, readmeContent)
                results.push(`📖 Created: NIA_SETUP.md`)

                const summary = `🎉 Project initialization completed!\n\n` +
                    `**Project Root:** ${project_root}\n` +
                    `**Profiles Configured:** ${profiles.length}\n` +
                    `**Files Created:** ${createdFiles.length + 1}\n\n` +
                    `**Results:**\n${results.join('\n')}\n\n` +
                    `**Next Steps:**\n` +
                    `1. Install the NIA MCP Server\n` +
                    `2. Start the server with: nia-mcp-server --stdio\n` +
                    `3. Test the integration in your IDE\n` +
                    `4. Read NIA_SETUP.md for detailed instructions`

                return {
                    content: [{
                        type: 'text',
                        text: summary
                    }],
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Error initializing project: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
                }
            }
        },
    )
} 
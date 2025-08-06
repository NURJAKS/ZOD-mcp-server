import type { McpToolContext } from '../types'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

// Supported IDE profiles
const SUPPORTED_PROFILES = [
  'cursor',
  'vscode', 
  'claude',
  'windsurf',
  'cline',
  'codex',
  'zed',
  'jetbrains',
  'neovim',
  'sublime'
] as const

type Profile = typeof SUPPORTED_PROFILES[number]

interface ProjectConfig {
  name: string
  description: string
  version: string
  type: 'application' | 'library' | 'tool'
  language: string
  framework?: string
  ideProfiles: Profile[]
}

export function registerProjectInitTools({ mcp }: McpToolContext): void {
  // initialize_project - Set up ZOD-enabled projects with IDE configs
  mcp.tool(
    'initialize_project',
    'Initialize a ZOD-enabled project with IDE-specific rules and configurations',
    {
      project_root: z.string().describe('Absolute path to the project root directory'),
      profiles: z.array(z.enum(SUPPORTED_PROFILES)).optional().default(['cursor']).describe('List of IDE profiles to set up'),
    },
    async ({ project_root, profiles }) => {
      try {
        // Validate project root
        if (!fs.existsSync(project_root)) {
          return {
            content: [{
              type: 'text',
              text: `❌ Project root directory does not exist: ${project_root}\n\nPlease provide a valid absolute path to an existing directory.`,
            }],
          }
        }

        // Validate profiles
        const invalidProfiles = profiles.filter(profile => !SUPPORTED_PROFILES.includes(profile))
        if (invalidProfiles.length > 0) {
          return {
            content: [{
              type: 'text',
              text: `❌ Invalid IDE profiles: ${invalidProfiles.join(', ')}\n\nSupported profiles: ${SUPPORTED_PROFILES.join(', ')}`,
            }],
          }
        }

        const results = await initializeProject(project_root, profiles)
        
        return {
          content: [{
            type: 'text',
            text: results,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error initializing project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function initializeProject(projectRoot: string, profiles: Profile[]): Promise<string> {
  const results: string[] = []
  const createdFiles: string[] = []
  const errors: string[] = []

      results.push(`🚀 Initializing ZOD-enabled project at: ${projectRoot}`)
  results.push(`📋 IDE Profiles: ${profiles.join(', ')}`)
  results.push('')

  // Create project configuration
  const projectConfig = await detectProjectConfig(projectRoot)
  
  // Initialize each IDE profile
  for (const profile of profiles) {
    try {
      const profileResults = await initializeIDEProfile(projectRoot, profile, projectConfig)
      createdFiles.push(...profileResults.createdFiles)
      results.push(profileResults.summary)
    } catch (error) {
      errors.push(`${profile}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

      // Create ZOD-specific files
    try {
      const zodResults = await createZODFiles(projectRoot, projectConfig)
      createdFiles.push(...zodResults.createdFiles)
      results.push(zodResults.summary)
    } catch (error) {
      errors.push(`ZOD files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

  // Summary
  results.push('')
  results.push('📊 Initialization Summary:')
  results.push(`✅ Created ${createdFiles.length} configuration files`)
  
  if (errors.length > 0) {
    results.push(`❌ ${errors.length} errors encountered`)
    results.push('Errors:')
    errors.forEach(error => results.push(`  • ${error}`))
  }

  results.push('')
  results.push('🎯 Next Steps:')
  results.push('• Open your project in the configured IDE')
  results.push('• Review and customize the generated configurations')
      results.push('• Use ZOD tools for enhanced development experience')

  return results.join('\n')
}

async function detectProjectConfig(projectRoot: string): Promise<ProjectConfig> {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const pyProjectPath = path.join(projectRoot, 'pyproject.toml')
  const cargoPath = path.join(projectRoot, 'Cargo.toml')
  const goModPath = path.join(projectRoot, 'go.mod')

  let config: ProjectConfig = {
    name: path.basename(projectRoot),
    description: 'ZOD-enabled project',
    version: '1.0.0',
    type: 'application',
    language: 'unknown',
    ideProfiles: []
  }

  // Detect project type
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    config = {
      ...config,
      name: packageJson.name || config.name,
      description: packageJson.description || config.description,
      version: packageJson.version || config.version,
      language: 'javascript',
      framework: packageJson.dependencies?.react ? 'react' : 
                 packageJson.dependencies?.vue ? 'vue' : 
                 packageJson.dependencies?.next ? 'next' : undefined
    }
  } else if (fs.existsSync(pyProjectPath)) {
    config.language = 'python'
  } else if (fs.existsSync(cargoPath)) {
    config.language = 'rust'
  } else if (fs.existsSync(goModPath)) {
    config.language = 'go'
  }

  return config
}

async function initializeIDEProfile(projectRoot: string, profile: Profile, config: ProjectConfig): Promise<{ summary: string, createdFiles: string[] }> {
  const createdFiles: string[] = []
  const summary: string[] = []

  summary.push(`🔧 Setting up ${profile.toUpperCase()} profile...`)

  switch (profile) {
    case 'cursor':
      createdFiles.push(...await setupCursor(projectRoot, config))
      break
    case 'vscode':
      createdFiles.push(...await setupVSCode(projectRoot, config))
      break
    case 'claude':
      createdFiles.push(...await setupClaude(projectRoot, config))
      break
    case 'windsurf':
      createdFiles.push(...await setupWindsurf(projectRoot, config))
      break
    case 'cline':
      createdFiles.push(...await setupCline(projectRoot, config))
      break
    case 'codex':
      createdFiles.push(...await setupCodex(projectRoot, config))
      break
    case 'zed':
      createdFiles.push(...await setupZed(projectRoot, config))
      break
    case 'jetbrains':
      createdFiles.push(...await setupJetBrains(projectRoot, config))
      break
    case 'neovim':
      createdFiles.push(...await setupNeovim(projectRoot, config))
      break
    case 'sublime':
      createdFiles.push(...await setupSublime(projectRoot, config))
      break
  }

  summary.push(`✅ ${profile} configuration created (${createdFiles.length} files)`)

  return { summary: summary.join('\n'), createdFiles }
}

async function setupCursor(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []
  const cursorDir = path.join(projectRoot, '.cursor')

  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true })
  }

  // Create .cursor/mcp.json
  const mcpConfig = {
    mcpServers: {
      "zod-mcp-server": {
        command: "node",
        args: [
          "/home/nurbek/Projects/My-mcp-server/MCP-server-copy/bin/cli.mjs",
          "--stdio",
          "--no-cache"
        ]
      }
    }
  }

  fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify(mcpConfig, null, 2))
  createdFiles.push('.cursor/mcp.json')

  // Create .cursor/settings.json
  const settings = {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": true,
      "source.organizeImports": true
    },
    "files.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/.git": true
    },
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true
    }
  }

  fs.writeFileSync(path.join(cursorDir, 'settings.json'), JSON.stringify(settings, null, 2))
  createdFiles.push('.cursor/settings.json')

  return createdFiles
}

async function setupVSCode(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []
  const vscodeDir = path.join(projectRoot, '.vscode')

  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true })
  }

  // Create .vscode/settings.json
  const settings = {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": true,
      "source.organizeImports": true
    },
    "files.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/.git": true
    },
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true
    }
  }

  fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 2))
  createdFiles.push('.vscode/settings.json')

  // Create .vscode/extensions.json
  const extensions = {
    "recommendations": [
      "ms-vscode.vscode-typescript-next",
      "esbenp.prettier-vscode",
      "ms-vscode.vscode-eslint"
    ]
  }

  fs.writeFileSync(path.join(vscodeDir, 'extensions.json'), JSON.stringify(extensions, null, 2))
  createdFiles.push('.vscode/extensions.json')

  return createdFiles
}

async function setupClaude(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .claude/config.json
  const claudeDir = path.join(projectRoot, '.claude')
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  const claudeConfig = {
    "project": {
      "name": config.name,
      "description": config.description,
      "language": config.language
    },
    "ai": {
      "model": "claude-3.5-sonnet",
      "context_window": 200000
    }
  }

  fs.writeFileSync(path.join(claudeDir, 'config.json'), JSON.stringify(claudeConfig, null, 2))
  createdFiles.push('.claude/config.json')

  return createdFiles
}

async function setupWindsurf(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .windsurf/config.json
  const windsurfDir = path.join(projectRoot, '.windsurf')
  if (!fs.existsSync(windsurfDir)) {
    fs.mkdirSync(windsurfDir, { recursive: true })
  }

  const windsurfConfig = {
    "project": {
      "name": config.name,
      "type": config.type,
      "language": config.language
    },
    "ai": {
      "enabled": true,
      "context_size": "large"
    }
  }

  fs.writeFileSync(path.join(windsurfDir, 'config.json'), JSON.stringify(windsurfConfig, null, 2))
  createdFiles.push('.windsurf/config.json')

  return createdFiles
}

async function setupCline(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .cline/config.json
  const clineDir = path.join(projectRoot, '.cline')
  if (!fs.existsSync(clineDir)) {
    fs.mkdirSync(clineDir, { recursive: true })
  }

  const clineConfig = {
    "project": {
      "name": config.name,
      "language": config.language
    },
    "ai": {
      "enabled": true
    }
  }

  fs.writeFileSync(path.join(clineDir, 'config.json'), JSON.stringify(clineConfig, null, 2))
  createdFiles.push('.cline/config.json')

  return createdFiles
}

async function setupCodex(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .codex/config.json
  const codexDir = path.join(projectRoot, '.codex')
  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true })
  }

  const codexConfig = {
    "project": {
      "name": config.name,
      "language": config.language
    }
  }

  fs.writeFileSync(path.join(codexDir, 'config.json'), JSON.stringify(codexConfig, null, 2))
  createdFiles.push('.codex/config.json')

  return createdFiles
}

async function setupZed(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .zed/settings.json
  const zedDir = path.join(projectRoot, '.zed')
  if (!fs.existsSync(zedDir)) {
    fs.mkdirSync(zedDir, { recursive: true })
  }

  const zedSettings = {
    "theme": "One Dark Pro",
    "font_size": 14,
    "line_height": 1.5,
    "tab_size": 2,
    "insert_spaces": true
  }

  fs.writeFileSync(path.join(zedDir, 'settings.json'), JSON.stringify(zedSettings, null, 2))
  createdFiles.push('.zed/settings.json')

  return createdFiles
}

async function setupJetBrains(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .idea/workspace.xml
  const ideaDir = path.join(projectRoot, '.idea')
  if (!fs.existsSync(ideaDir)) {
    fs.mkdirSync(ideaDir, { recursive: true })
  }

  const workspaceXml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectId" id="zod-${config.name}"/>
  <component name="PropertiesComponent">
    <property name="RunOnceActivity.OpenProjectViewOnStart" value="true" />
    <property name="RunOnceActivity.ShowReadmeOnStart" value="true" />
  </component>
</project>`

  fs.writeFileSync(path.join(ideaDir, 'workspace.xml'), workspaceXml)
  createdFiles.push('.idea/workspace.xml')

  return createdFiles
}

async function setupNeovim(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .nvim/init.lua
  const nvimDir = path.join(projectRoot, '.nvim')
  if (!fs.existsSync(nvimDir)) {
    fs.mkdirSync(nvimDir, { recursive: true })
  }

  const initLua = `-- ZOD Project Neovim Configuration
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true
vim.opt.autoindent = true
vim.opt.smartindent = true`

  fs.writeFileSync(path.join(nvimDir, 'init.lua'), initLua)
  createdFiles.push('.nvim/init.lua')

  return createdFiles
}

async function setupSublime(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const createdFiles: string[] = []

  // Create .sublime-project
  const sublimeProject = {
    "folders": [
      {
        "path": ".",
        "name": config.name
      }
    ],
    "settings": {
      "tab_size": 2,
      "translate_tabs_to_spaces": true,
      "rulers": [80, 120],
      "word_wrap": false
    }
  }

  fs.writeFileSync(path.join(projectRoot, `${config.name}.sublime-project`), JSON.stringify(sublimeProject, null, 2))
  createdFiles.push(`${config.name}.sublime-project`)

  return createdFiles
}

async function createZODFiles(projectRoot: string, config: ProjectConfig): Promise<{ summary: string, createdFiles: string[] }> {
  const createdFiles: string[] = []
  const summary: string[] = []

      summary.push('🔧 Creating ZOD-specific files...')

      // Create .zod/config.json
    const zodDir = path.join(projectRoot, '.zod')
    if (!fs.existsSync(zodDir)) {
      fs.mkdirSync(zodDir, { recursive: true })
    }

    const zodConfig = {
    "project": {
      "name": config.name,
      "description": config.description,
      "version": config.version,
      "type": config.type,
      "language": config.language,
      "framework": config.framework
    },
          "zod": {
      "enabled": true,
      "version": "1.2.4",
      "features": [
        "repository_indexing",
        "documentation_search",
        "web_search",
        "code_analysis"
      ]
    }
  }

      fs.writeFileSync(path.join(zodDir, 'config.json'), JSON.stringify(zodConfig, null, 2))
    createdFiles.push('.zod/config.json')

      // Create .zod/README.md
    const zodReadme = `# ZOD Project Configuration

This project is configured with ZOD (Zod MCP Server) for enhanced development experience.

## Features
- Repository indexing and search
- Documentation management
- Web search and research
- Code analysis and insights

## Usage
- Use MCP Inspector to access NIA tools
- Index repositories with \`index_repository\`
- Search documentation with \`search_documentation\`
- Perform web research with \`nia_web_search\`

## Configuration
- Project: ${config.name}
- Language: ${config.language}
- Type: ${config.type}
- Version: ${config.version}
`

      fs.writeFileSync(path.join(zodDir, 'README.md'), zodReadme)
    createdFiles.push('.zod/README.md')

      summary.push(`✅ ZOD configuration created (${createdFiles.length} files)`)

  return { summary: summary.join('\n'), createdFiles }
} 
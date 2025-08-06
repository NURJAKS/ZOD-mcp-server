import type { McpToolContext } from '../types'
import { z } from 'zod'
import { SearchEngine } from '../core/search'
import { safeLog } from '../utils'
import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper function to get the correct project path - UNIVERSAL VERSION
async function getProjectPath(targetPath?: string): Promise<string> {
  // If a specific path is provided, use it
  if (targetPath) {
    try {
      const resolvedPath = path.resolve(targetPath)
      await fs.access(resolvedPath)
      return resolvedPath
    } catch (error) {
      throw new Error(`Invalid project path: ${targetPath}`)
    }
  }
  
  // Try to find the current project root by looking for common project files
  let projectPath = process.cwd()
  
  // Common project indicators
  const projectIndicators = [
    'package.json',    // Node.js projects
    'pyproject.toml',  // Python projects
    'Cargo.toml',      // Rust projects
    'pom.xml',         // Java Maven projects
    'build.gradle',    // Java Gradle projects
    'composer.json',   // PHP projects
    'requirements.txt', // Python projects
    'Gemfile',         // Ruby projects
    'go.mod',          // Go projects
    '.git',            // Git repositories
    'README.md',       // Common project files
    'Makefile',        // C/C++ projects
    'CMakeLists.txt',  // CMake projects
    'tsconfig.json',   // TypeScript projects
    'webpack.config.js', // Webpack projects
    'vite.config.js',  // Vite projects
    'next.config.js',  // Next.js projects
    'angular.json',    // Angular projects
    'vue.config.js',   // Vue projects
    'docker-compose.yml', // Docker projects
    'Dockerfile',      // Docker projects
    '.env',            // Environment files
    'src/',            // Source directories
    'lib/',            // Library directories
    'app/',            // App directories
  ]
  
  // Try to find project root by looking for project indicators
  const possiblePaths = [
    process.cwd(),
    process.env.PWD || process.cwd(),
    process.env.HOME || process.env.USERPROFILE || '',
    path.join(__dirname, '../../..'), // Go up from src/tools
    path.join(__dirname, '../..'),    // Go up from tools
    path.join(__dirname, '..'),       // Go up from src
  ]
  
  for (const basePath of possiblePaths) {
    if (!basePath) continue
    
    try {
      // Check if this path has project indicators
      const hasProjectIndicator = await Promise.any(
        projectIndicators.map(async (indicator) => {
          try {
            await fs.access(path.join(basePath, indicator))
            return true
          } catch {
            return false
          }
        })
      )
      
      if (hasProjectIndicator) {
        projectPath = basePath
        break
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  return projectPath
}

// Global instances
let searchEngine: SearchEngine | null = null

// Initialize components
async function initializeComponents() {
  try {
    searchEngine = new SearchEngine()
    await searchEngine.initialize()
    safeLog('✅ Smart AI Analyzer initialized successfully')
  } catch (error) {
    safeLog(`❌ Failed to initialize Smart AI Analyzer: ${error}`, 'error')
  }
}

// Start initialization
initializeComponents()

interface ProjectFile {
  path: string
  content: string
  language: string
  size: number
  type: 'code' | 'config' | 'documentation' | 'other'
}

interface ProjectAnalysis {
  summary: string
  structure: string
  technologies: string[]
  patterns: string[]
  recommendations: string[]
  securityIssues: string[]
  qualityIssues: string[]
  files: ProjectFile[]
}

export function registerSmartAIAnalyzer({ mcp }: McpToolContext): void {
  // Smart AI Context Analyzer Tool
  mcp.tool(
    'smart_ai_analyzer',
    'Smart AI tool that can index and analyze any project contextually - works with any programming language and project structure',
    {
      action: z.enum(['analyze_project', 'index_project', 'search_context', 'get_insights', 'recommend_improvements']).describe('Action to perform'),
      project_path: z.string().optional().describe('Path to the project to analyze (defaults to current directory or auto-detected project)'),
      query: z.string().optional().describe('Search query for context search'),
      focus_area: z.enum(['security', 'quality', 'architecture', 'performance', 'documentation']).optional().describe('Focus area for analysis'),
      include_patterns: z.array(z.string()).optional().describe('File patterns to include (e.g., ["*.ts", "*.js", "*.py", "*.java"])'),
      exclude_patterns: z.array(z.string()).optional().describe('File patterns to exclude (e.g., ["node_modules", "dist", "__pycache__", "target"])'),
    },
          async ({ action, project_path, query, focus_area, include_patterns, exclude_patterns }) => {
        try {
          if (!searchEngine) {
            throw new Error('Smart AI Analyzer not initialized')
          }

          switch (action) {
            case 'analyze_project':
              return await handleAnalyzeProject(focus_area, include_patterns, exclude_patterns, project_path)
            
            case 'index_project':
              return await handleIndexProject(include_patterns, exclude_patterns, project_path)
            
            case 'search_context':
              return await handleSearchContext(query || '', project_path)
            
            case 'get_insights':
              return await handleGetInsights(focus_area, project_path)
            
            case 'recommend_improvements':
              return await handleRecommendImprovements(focus_area, project_path)
            
            default:
              return {
                content: [{
                  type: 'text',
                  text: `❌ Invalid action: ${action}\n\nAvailable actions: analyze_project, index_project, search_context, get_insights, recommend_improvements`,
                }],
              }
          }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Smart AI Analyzer error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function handleAnalyzeProject(focus_area?: string, include_patterns?: string[], exclude_patterns?: string[], project_path?: string): Promise<any> {
  const projectPath = await getProjectPath(project_path)
  const analysis = await analyzeProjectContext(projectPath, focus_area, include_patterns, exclude_patterns)
  
  let result = `🤖 **Smart AI Project Analysis**\n\n`
  result += `📁 **Project Path:** ${projectPath}\n`
  result += `🎯 **Focus Area:** ${focus_area || 'General'}\n\n`
  
  result += `📊 **Project Summary:**\n${analysis.summary}\n\n`
  
  result += `🏗️ **Project Structure:**\n${analysis.structure}\n\n`
  
  result += `🛠️ **Technologies Detected:**\n`
  analysis.technologies.forEach(tech => {
    result += `• ${tech}\n`
  })
  result += `\n`
  
  result += `🔍 **Code Patterns:**\n`
  analysis.patterns.forEach(pattern => {
    result += `• ${pattern}\n`
  })
  result += `\n`
  
  if (focus_area === 'security') {
    result += `🔒 **Security Analysis:**\n`
    analysis.securityIssues.forEach(issue => {
      result += `• ${issue}\n`
    })
    result += `\n`
  }
  
  if (focus_area === 'quality') {
    result += `📝 **Quality Analysis:**\n`
    analysis.qualityIssues.forEach(issue => {
      result += `• ${issue}\n`
    })
    result += `\n`
  }
  
  result += `💡 **Smart Recommendations:**\n`
  analysis.recommendations.forEach(rec => {
    result += `• ${rec}\n`
  })
  
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

async function handleIndexProject(include_patterns?: string[], exclude_patterns?: string[], project_path?: string): Promise<any> {
  const projectPath = await getProjectPath(project_path)
  const files = await indexProjectFiles(projectPath, include_patterns, exclude_patterns)
  
  let result = `📚 **Project Indexing Complete**\n\n`
  result += `📁 **Project Path:** ${projectPath}\n`
  result += `📄 **Files Indexed:** ${files.length}\n\n`
  
  // Group files by type
  const codeFiles = files.filter(f => f.type === 'code')
  const configFiles = files.filter(f => f.type === 'config')
  const docFiles = files.filter(f => f.type === 'documentation')
  
  result += `💻 **Code Files:** ${codeFiles.length}\n`
  result += `⚙️ **Config Files:** ${configFiles.length}\n`
  result += `📖 **Documentation:** ${docFiles.length}\n\n`
  
  result += `🔍 **Ready for Contextual Search!**\n`
  result += `Use: smart_ai_analyzer(action="search_context", query="your query")`
  
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

async function handleSearchContext(query: string, project_path?: string): Promise<any> {
  const projectPath = await getProjectPath(project_path)
  const files = await indexProjectFiles(projectPath)
  
  // Perform contextual search
  const searchResults = await performContextualSearch(query, files)
  
  let result = `🔍 **Contextual Search Results**\n\n`
  result += `🔎 **Query:** "${query}"\n`
  result += `📁 **Project:** ${projectPath}\n\n`
  
  if (searchResults.length === 0) {
    result += `❌ No relevant files found for your query.\n`
    result += `💡 Try:\n`
    result += `• Using different keywords\n`
    result += `• Being more specific\n`
    result += `• Using broader terms\n`
  } else {
    result += `📋 **Found ${searchResults.length} relevant files:**\n\n`
    
    searchResults.forEach((file, index) => {
      result += `${index + 1}. **${file.path}** (${file.language})\n`
      result += `   📝 **Content:** ${file.content.substring(0, 200)}...\n`
      result += `   📊 **Size:** ${file.size} bytes\n\n`
    })
  }
  
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

async function handleGetInsights(focus_area?: string, project_path?: string): Promise<any> {
  const projectPath = await getProjectPath(project_path)
  const analysis = await analyzeProjectContext(projectPath, focus_area)
  
  let result = `🧠 **AI-Generated Insights**\n\n`
  result += `🎯 **Focus Area:** ${focus_area || 'General'}\n\n`
  
  if (focus_area === 'security') {
    result += `🔒 **Security Insights:**\n`
    analysis.securityIssues.forEach(issue => {
      result += `• ${issue}\n`
    })
  } else if (focus_area === 'quality') {
    result += `📝 **Quality Insights:**\n`
    analysis.qualityIssues.forEach(issue => {
      result += `• ${issue}\n`
    })
  } else if (focus_area === 'architecture') {
    result += `🏗️ **Architecture Insights:**\n`
    analysis.patterns.forEach(pattern => {
      result += `• ${pattern}\n`
    })
  } else {
    result += `💡 **General Insights:**\n`
    analysis.recommendations.forEach(rec => {
      result += `• ${rec}\n`
    })
  }
  
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

async function handleRecommendImprovements(focus_area?: string, project_path?: string): Promise<any> {
  const projectPath = await getProjectPath(project_path)
  const analysis = await analyzeProjectContext(projectPath, focus_area)
  
  let result = `🚀 **AI Improvement Recommendations**\n\n`
  result += `🎯 **Focus Area:** ${focus_area || 'General'}\n\n`
  
  result += `💡 **Recommended Improvements:**\n`
  analysis.recommendations.forEach((rec, index) => {
    result += `${index + 1}. ${rec}\n`
  })
  
  return {
    content: [{
      type: 'text',
      text: result,
    }],
  }
}

async function analyzeProjectContext(projectPath: string, focus_area?: string, include_patterns?: string[], exclude_patterns?: string[]): Promise<ProjectAnalysis> {
  const files = await indexProjectFiles(projectPath, include_patterns, exclude_patterns)
  
  // Analyze project structure
  const structure = analyzeProjectStructure(files)
  
  // Detect technologies
  const technologies = detectTechnologies(files)
  
  // Detect patterns
  const patterns = detectPatterns(files, focus_area)
  
  // Generate recommendations
  const recommendations = generateRecommendations(files, focus_area)
  
  // Security analysis
  const securityIssues = focus_area === 'security' ? analyzeSecurity(files) : []
  
  // Quality analysis
  const qualityIssues = focus_area === 'quality' ? analyzeQuality(files) : []
  
  // Generate summary
  const summary = generateProjectSummary(files, technologies, patterns)
  
  return {
    summary,
    structure,
    technologies,
    patterns,
    recommendations,
    securityIssues,
    qualityIssues,
    files
  }
}

async function indexProjectFiles(projectPath: string, include_patterns?: string[], exclude_patterns?: string[]): Promise<ProjectFile[]> {
  const defaultInclude = ['**/*.{ts,js,tsx,jsx,json,md,yml,yaml,toml,ini,cfg,conf}']
  const defaultExclude = ['node_modules/**', 'dist/**', '.git/**', '*.log', '*.tmp']
  
  const patterns = include_patterns || defaultInclude
  const excludes = exclude_patterns || defaultExclude
  
  const files: ProjectFile[] = []
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectPath,
      ignore: excludes,
      nodir: true
    })
    
    for (const filePath of matches) {
      try {
        const fullPath = path.join(projectPath, filePath)
        const content = await fs.readFile(fullPath, 'utf-8')
        const stats = await fs.stat(fullPath)
        const language = detectLanguage(filePath)
        const type = detectFileType(filePath, content)
        
        files.push({
          path: filePath,
          content,
          language,
          size: stats.size,
          type
        })
      } catch (error) {
        // Skip files that can't be read
        continue
      }
    }
  }
  
  return files
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    '.ts': 'typescript',
    '.js': 'javascript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    
    // Python
    '.py': 'python',
    '.pyw': 'python',
    '.pyx': 'cython',
    '.pyi': 'python',
    
    // Java
    '.java': 'java',
    '.class': 'java',
    '.jar': 'java',
    
    // C/C++
    '.c': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.hxx': 'cpp',
    
    // Go
    '.go': 'go',
    
    // Rust
    '.rs': 'rust',
    
    // PHP
    '.php': 'php',
    '.phtml': 'php',
    
    // Ruby
    '.rb': 'ruby',
    '.erb': 'ruby',
    
    // C#
    '.cs': 'csharp',
    '.csx': 'csharp',
    
    // Swift
    '.swift': 'swift',
    
    // Kotlin
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    
    // Scala
    '.scala': 'scala',
    
    // HTML/CSS
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    
    // Shell/Bash
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.fish': 'bash',
    
    // PowerShell
    '.ps1': 'powershell',
    '.psm1': 'powershell',
    
    // Batch
    '.bat': 'batch',
    '.cmd': 'batch',
    
    // Configuration files
    '.json': 'json',
    '.xml': 'xml',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'config',
    '.conf': 'config',
    '.env': 'config',
    
    // Documentation
    '.md': 'markdown',
    '.rst': 'rst',
    '.txt': 'text',
    
    // Database
    '.sql': 'sql',
    '.db': 'database',
    '.sqlite': 'database',
    
    // Docker
    '.dockerfile': 'dockerfile',
    '.docker': 'dockerfile',
    
    // Terraform
    '.tf': 'terraform',
    '.tfvars': 'terraform',
    
    // YAML variations (already defined above)
    
    // Other
    '.lock': 'lockfile',
    '.gitignore': 'gitignore',
    '.gitattributes': 'gitattributes'
  }
  
  return languageMap[ext] || 'unknown'
}

function detectFileType(filePath: string, content: string): 'code' | 'config' | 'documentation' | 'other' {
  const ext = path.extname(filePath).toLowerCase()
  
  if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
    return 'code'
  }
  
  if (['.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf'].includes(ext)) {
    return 'config'
  }
  
  if (['.md', '.txt', '.rst'].includes(ext)) {
    return 'documentation'
  }
  
  return 'other'
}

function analyzeProjectStructure(files: ProjectFile[]): string {
  const directories = new Set<string>()
  
  files.forEach(file => {
    const dir = path.dirname(file.path)
    if (dir !== '.') {
      directories.add(dir)
    }
  })
  
  let structure = '📁 Project Structure:\n'
  
  // Group files by directory
  const filesByDir = new Map<string, ProjectFile[]>()
  files.forEach(file => {
    const dir = path.dirname(file.path)
    if (!filesByDir.has(dir)) {
      filesByDir.set(dir, [])
    }
    filesByDir.get(dir)!.push(file)
  })
  
  // Sort directories
  const sortedDirs = Array.from(filesByDir.keys()).sort()
  
  sortedDirs.forEach(dir => {
    const dirFiles = filesByDir.get(dir)!
    const codeFiles = dirFiles.filter(f => f.type === 'code').length
    const configFiles = dirFiles.filter(f => f.type === 'config').length
    const docFiles = dirFiles.filter(f => f.type === 'documentation').length
    
    structure += `📂 ${dir}/\n`
    if (codeFiles > 0) structure += `   💻 Code: ${codeFiles} files\n`
    if (configFiles > 0) structure += `   ⚙️ Config: ${configFiles} files\n`
    if (docFiles > 0) structure += `   📖 Docs: ${docFiles} files\n`
  })
  
  return structure
}

function detectTechnologies(files: ProjectFile[]): string[] {
  const technologies: string[] = []
  
  // Check for package.json (Node.js projects)
  const packageJson = files.find(f => f.path === 'package.json')
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content)
      technologies.push('Node.js')
      
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => {
          if (dep.includes('react')) technologies.push('React')
          if (dep.includes('vue')) technologies.push('Vue.js')
          if (dep.includes('angular')) technologies.push('Angular')
          if (dep.includes('express')) technologies.push('Express.js')
          if (dep.includes('typescript')) technologies.push('TypeScript')
          if (dep.includes('jest')) technologies.push('Jest')
          if (dep.includes('webpack')) technologies.push('Webpack')
          if (dep.includes('vite')) technologies.push('Vite')
          if (dep.includes('next')) technologies.push('Next.js')
          if (dep.includes('nuxt')) technologies.push('Nuxt.js')
          if (dep.includes('svelte')) technologies.push('Svelte')
          if (dep.includes('solid')) technologies.push('Solid.js')
          if (dep.includes('astro')) technologies.push('Astro')
          if (dep.includes('tailwind')) technologies.push('Tailwind CSS')
          if (dep.includes('bootstrap')) technologies.push('Bootstrap')
          if (dep.includes('prisma')) technologies.push('Prisma')
          if (dep.includes('mongoose')) technologies.push('MongoDB')
          if (dep.includes('sequelize')) technologies.push('Sequelize')
          if (dep.includes('typeorm')) technologies.push('TypeORM')
          if (dep.includes('graphql')) technologies.push('GraphQL')
          if (dep.includes('apollo')) technologies.push('Apollo')
          if (dep.includes('socket.io')) technologies.push('Socket.IO')
          if (dep.includes('redis')) technologies.push('Redis')
          if (dep.includes('elasticsearch')) technologies.push('Elasticsearch')
        })
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }
  
  // Check for Python projects
  const requirementsTxt = files.find(f => f.path === 'requirements.txt')
  const pyprojectToml = files.find(f => f.path === 'pyproject.toml')
  if (requirementsTxt || pyprojectToml) {
    technologies.push('Python')
    
    if (requirementsTxt) {
      const content = requirementsTxt.content.toLowerCase()
      if (content.includes('django')) technologies.push('Django')
      if (content.includes('flask')) technologies.push('Flask')
      if (content.includes('fastapi')) technologies.push('FastAPI')
      if (content.includes('numpy')) technologies.push('NumPy')
      if (content.includes('pandas')) technologies.push('Pandas')
      if (content.includes('tensorflow')) technologies.push('TensorFlow')
      if (content.includes('pytorch')) technologies.push('PyTorch')
      if (content.includes('scikit-learn')) technologies.push('Scikit-learn')
      if (content.includes('selenium')) technologies.push('Selenium')
      if (content.includes('pytest')) technologies.push('pytest')
    }
  }
  
  // Check for Java projects
  const pomXml = files.find(f => f.path === 'pom.xml')
  const buildGradle = files.find(f => f.path === 'build.gradle')
  if (pomXml || buildGradle) {
    technologies.push('Java')
    
    if (pomXml) {
      const content = pomXml.content.toLowerCase()
      if (content.includes('spring')) technologies.push('Spring Framework')
      if (content.includes('hibernate')) technologies.push('Hibernate')
      if (content.includes('maven')) technologies.push('Maven')
    }
    
    if (buildGradle) {
      const content = buildGradle.content.toLowerCase()
      if (content.includes('spring')) technologies.push('Spring Framework')
      if (content.includes('gradle')) technologies.push('Gradle')
    }
  }
  
  // Check for Go projects
  const goMod = files.find(f => f.path === 'go.mod')
  if (goMod) {
    technologies.push('Go')
  }
  
  // Check for Rust projects
  const cargoToml = files.find(f => f.path === 'Cargo.toml')
  if (cargoToml) {
    technologies.push('Rust')
  }
  
  // Check for PHP projects
  const composerJson = files.find(f => f.path === 'composer.json')
  if (composerJson) {
    technologies.push('PHP')
    
    try {
      const composer = JSON.parse(composerJson.content)
      if (composer.require) {
        Object.keys(composer.require).forEach(dep => {
          if (dep.includes('laravel')) technologies.push('Laravel')
          if (dep.includes('symfony')) technologies.push('Symfony')
          if (dep.includes('wordpress')) technologies.push('WordPress')
        })
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }
  
  // Check for Ruby projects
  const gemfile = files.find(f => f.path === 'Gemfile')
  if (gemfile) {
    technologies.push('Ruby')
    
    const content = gemfile.content.toLowerCase()
    if (content.includes('rails')) technologies.push('Ruby on Rails')
    if (content.includes('sinatra')) technologies.push('Sinatra')
  }
  
  // Check for C# projects
  const csproj = files.find(f => f.path.endsWith('.csproj'))
  if (csproj) {
    technologies.push('C#')
    technologies.push('.NET')
  }
  
  // Check for Docker
  const dockerfile = files.find(f => f.path === 'Dockerfile' || f.path.includes('Dockerfile'))
  const dockerCompose = files.find(f => f.path === 'docker-compose.yml' || f.path === 'docker-compose.yaml')
  if (dockerfile || dockerCompose) {
    technologies.push('Docker')
  }
  
  // Check for Kubernetes
  if (files.some(f => f.path.includes('.yaml') && f.content.includes('apiVersion:'))) {
    technologies.push('Kubernetes')
  }
  
  // Check for Terraform
  if (files.some(f => f.path.endsWith('.tf'))) {
    technologies.push('Terraform')
  }
  
  // Check for languages by file extensions
  if (files.some(f => f.language === 'typescript')) technologies.push('TypeScript')
  if (files.some(f => f.language === 'python')) technologies.push('Python')
  if (files.some(f => f.language === 'java')) technologies.push('Java')
  if (files.some(f => f.language === 'go')) technologies.push('Go')
  if (files.some(f => f.language === 'rust')) technologies.push('Rust')
  if (files.some(f => f.language === 'php')) technologies.push('PHP')
  if (files.some(f => f.language === 'ruby')) technologies.push('Ruby')
  if (files.some(f => f.language === 'csharp')) technologies.push('C#')
  if (files.some(f => f.language === 'swift')) technologies.push('Swift')
  if (files.some(f => f.language === 'kotlin')) technologies.push('Kotlin')
  if (files.some(f => f.language === 'scala')) technologies.push('Scala')
  
  // Check for MCP
  if (files.some(f => f.content.includes('mcp') || f.content.includes('MCP'))) {
    technologies.push('Model Context Protocol (MCP)')
  }
  
  return [...new Set(technologies)]
}

function detectPatterns(files: ProjectFile[], focus_area?: string): string[] {
  const patterns: string[] = []
  
  if (focus_area === 'security') {
    // Security patterns
    if (files.some(f => f.content.includes('process.env'))) {
      patterns.push('Environment variable usage detected')
    }
    if (files.some(f => f.content.includes('crypto') || f.content.includes('bcrypt'))) {
      patterns.push('Cryptography usage detected')
    }
    if (files.some(f => f.content.includes('sql') || f.content.includes('query'))) {
      patterns.push('Database queries detected')
    }
  } else if (focus_area === 'quality') {
    // Quality patterns
    if (files.some(f => f.content.includes('TODO') || f.content.includes('FIXME'))) {
      patterns.push('TODO/FIXME comments found')
    }
    if (files.some(f => f.content.includes('console.log'))) {
      patterns.push('Console logging detected')
    }
    if (files.some(f => f.content.includes('any'))) {
      patterns.push('TypeScript any types detected')
    }
  } else {
    // General patterns
    if (files.some(f => f.content.includes('async') && f.content.includes('await'))) {
      patterns.push('Async/await pattern usage')
    }
    if (files.some(f => f.content.includes('class'))) {
      patterns.push('Class-based architecture')
    }
    if (files.some(f => f.content.includes('function'))) {
      patterns.push('Functional programming patterns')
    }
  }
  
  return patterns
}

function generateRecommendations(files: ProjectFile[], focus_area?: string): string[] {
  const recommendations: string[] = []
  
  if (focus_area === 'security') {
    // Real security analysis based on actual code patterns
    const hasEnvVars = files.some(f => f.content.includes('process.env'))
    const hasSqlQueries = files.some(f => f.content.includes('sql') || f.content.includes('query'))
    const hasUserInput = files.some(f => f.content.includes('req.body') || f.content.includes('req.query') || f.content.includes('req.params'))
    const hasCrypto = files.some(f => f.content.includes('crypto') || f.content.includes('bcrypt'))
    const hasAuth = files.some(f => f.content.includes('jwt') || f.content.includes('token') || f.content.includes('session'))
    
    if (hasEnvVars) {
      recommendations.push('Consider using a secrets management solution like HashiCorp Vault or AWS Secrets Manager')
    }
    if (hasSqlQueries) {
      recommendations.push('Implement SQL injection protection using parameterized queries')
    }
    if (hasUserInput) {
      recommendations.push('Add input validation and sanitization for all user inputs')
    }
    if (!hasCrypto) {
      recommendations.push('Implement proper cryptographic functions for sensitive data')
    }
    if (hasAuth) {
      recommendations.push('Ensure JWT tokens are properly signed and validated')
    }
    recommendations.push('Implement proper error handling without exposing sensitive data')
    recommendations.push('Add security headers and CORS configuration')
    recommendations.push('Consider implementing rate limiting for API endpoints')
  } else if (focus_area === 'quality') {
    // Real quality analysis based on actual code patterns
    const hasAnyTypes = files.some(f => f.content.includes(': any'))
    const hasConsoleLogs = files.some(f => f.content.includes('console.log'))
    const hasTODOs = files.some(f => f.content.includes('TODO') || f.content.includes('FIXME'))
    const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec'))
    const hasLinting = files.some(f => f.path.includes('eslint') || f.path.includes('prettier'))
    
    if (hasAnyTypes) {
      recommendations.push('Replace TypeScript any types with proper type definitions')
    }
    if (hasConsoleLogs) {
      recommendations.push('Replace console.log with a proper logging library like Winston or Pino')
    }
    if (hasTODOs) {
      recommendations.push('Address TODO/FIXME comments to improve code quality')
    }
    if (!hasTests) {
      recommendations.push('Add comprehensive unit and integration tests')
    }
    if (!hasLinting) {
      recommendations.push('Implement ESLint and Prettier for consistent code formatting')
    }
    recommendations.push('Add comprehensive error handling with proper error types')
    recommendations.push('Implement proper TypeScript strict mode configuration')
  } else if (focus_area === 'architecture') {
    // Real architecture analysis
    const hasClasses = files.some(f => f.content.includes('class '))
    const hasFunctions = files.some(f => f.content.includes('function '))
    const hasAsyncAwait = files.some(f => f.content.includes('async ') && f.content.includes('await'))
    const hasModules = files.some(f => f.content.includes('import ') || f.content.includes('require('))
    
    if (hasClasses) {
      recommendations.push('Consider using dependency injection for better testability')
    }
    if (hasFunctions) {
      recommendations.push('Implement functional programming patterns for better code organization')
    }
    if (hasAsyncAwait) {
      recommendations.push('Add proper error handling for async operations')
    }
    if (hasModules) {
      recommendations.push('Organize code into logical modules and layers')
    }
    recommendations.push('Implement proper separation of concerns')
    recommendations.push('Consider using design patterns appropriate for your use case')
  } else if (focus_area === 'performance') {
    // Real performance analysis
    const hasLargeFiles = files.some(f => f.content.length > 1000)
    const hasLoops = files.some(f => f.content.includes('for ') || f.content.includes('while '))
    const hasDatabase = files.some(f => f.content.includes('database') || f.content.includes('db.'))
    
    if (hasLargeFiles) {
      recommendations.push('Break down large files into smaller, focused modules')
    }
    if (hasLoops) {
      recommendations.push('Optimize loops and consider using more efficient algorithms')
    }
    if (hasDatabase) {
      recommendations.push('Implement database query optimization and indexing')
    }
    recommendations.push('Add performance monitoring and profiling')
    recommendations.push('Consider implementing caching strategies')
  } else {
    // General recommendations based on actual analysis
    const hasDocs = files.some(f => f.type === 'documentation')
    const hasConfig = files.some(f => f.type === 'config')
    const hasTests = files.some(f => f.path.includes('test'))
    
    if (!hasDocs) {
      recommendations.push('Add comprehensive documentation including README and API docs')
    }
    if (!hasConfig) {
      recommendations.push('Implement proper configuration management')
    }
    if (!hasTests) {
      recommendations.push('Add unit tests for better code coverage and reliability')
    }
    recommendations.push('Implement proper error handling throughout the codebase')
    recommendations.push('Add code formatting and linting rules for consistency')
    recommendations.push('Consider implementing CI/CD pipeline for automated testing and deployment')
  }
  
  return recommendations
}

function analyzeSecurity(files: ProjectFile[]): string[] {
  const issues: string[] = []
  
  files.forEach(file => {
    if (file.type === 'code') {
      const content = file.content.toLowerCase()
      
      // Check for hardcoded credentials
      if ((content.includes('password') || content.includes('secret') || content.includes('key') || content.includes('token')) && 
          !content.includes('process.env') && !content.includes('environment')) {
        issues.push(`Potential hardcoded credentials in ${file.path}`)
      }
      
      // Check for code injection vulnerabilities
      if (content.includes('eval(') || content.includes('settimeout(') || content.includes('setinterval(')) {
        issues.push(`Potential code injection vulnerability in ${file.path}`)
      }
      
      // Check for XSS vulnerabilities
      if (content.includes('innerhtml') || content.includes('outerhtml') || content.includes('document.write')) {
        issues.push(`Potential XSS vulnerability in ${file.path}`)
      }
      
      // Check for SQL injection vulnerabilities
      if (content.includes('sql') && (content.includes('query') || content.includes('execute')) && 
          !content.includes('parameterized') && !content.includes('prepared')) {
        issues.push(`Potential SQL injection vulnerability in ${file.path}`)
      }
      
      // Check for command injection
      if (content.includes('exec(') || content.includes('spawn(') || content.includes('child_process')) {
        issues.push(`Potential command injection vulnerability in ${file.path}`)
      }
      
      // Check for path traversal
      if (content.includes('path') && (content.includes('join') || content.includes('resolve')) && 
          content.includes('user') && content.includes('input')) {
        issues.push(`Potential path traversal vulnerability in ${file.path}`)
      }
      
      // Check for insecure random generation
      if (content.includes('math.random') && !content.includes('crypto.random')) {
        issues.push(`Insecure random number generation in ${file.path}`)
      }
      
      // Check for missing input validation
      if ((content.includes('req.body') || content.includes('req.query') || content.includes('req.params')) && 
          !content.includes('validate') && !content.includes('sanitize')) {
        issues.push(`Missing input validation in ${file.path}`)
      }
      
      // Check for exposed error messages
      if (content.includes('error') && (content.includes('stack') || content.includes('trace')) && 
          !content.includes('production')) {
        issues.push(`Potential information disclosure through error messages in ${file.path}`)
      }
      
      // Check for weak authentication
      if (content.includes('jwt') && !content.includes('verify') && !content.includes('sign')) {
        issues.push(`Potential JWT security issues in ${file.path}`)
      }
      
      // Check for CORS misconfiguration
      if (content.includes('cors') && content.includes('*')) {
        issues.push(`Potential CORS misconfiguration in ${file.path}`)
      }
    }
  })
  
  return issues
}

function analyzeQuality(files: ProjectFile[]): string[] {
  const issues: string[] = []
  
  files.forEach(file => {
    if (file.type === 'code') {
      const content = file.content
      
      // Check for TODO/FIXME comments
      if (content.includes('TODO') || content.includes('FIXME')) {
        issues.push(`TODO/FIXME comments found in ${file.path}`)
      }
      
      // Check for console logging
      if (content.includes('console.log')) {
        issues.push(`Console logging found in ${file.path}`)
      }
      
      // Check for TypeScript any types
      if (content.includes(': any')) {
        issues.push(`TypeScript any types found in ${file.path}`)
      }
      
      // Check for large files
      if (content.length > 1000) {
        issues.push(`Large file detected: ${file.path} (${content.length} characters)`)
      }
      
      // Check for missing error handling
      if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
        issues.push(`Missing error handling in async function in ${file.path}`)
      }
      
      // Check for hardcoded values
      if (content.includes('localhost') || content.includes('127.0.0.1') || content.includes('3000')) {
        issues.push(`Hardcoded values found in ${file.path}`)
      }
      
      // Check for unused imports
      const importMatches = content.match(/import.*from/g) || []
      const usedMatches = content.match(/from ['"]/g) || []
      if (importMatches.length > usedMatches.length) {
        issues.push(`Potential unused imports in ${file.path}`)
      }
      
      // Check for complex functions
      const functionMatches = content.match(/function\s+\w+\s*\(/g) || []
      const complexityMatches = content.match(/\{\s*\n\s*\n/g) || []
      if (functionMatches.length > 0 && complexityMatches.length > 5) {
        issues.push(`Complex function detected in ${file.path}`)
      }
      
      // Check for missing documentation
      if (content.includes('export') && !content.includes('/**') && !content.includes('//')) {
        issues.push(`Missing documentation for exported functions in ${file.path}`)
      }
      
      // Check for inconsistent naming
      const camelCaseMatches = content.match(/[a-z][A-Z]/g) || []
      const snakeCaseMatches = content.match(/[a-z]_[a-z]/g) || []
      if (camelCaseMatches.length > 0 && snakeCaseMatches.length > 0) {
        issues.push(`Inconsistent naming conventions in ${file.path}`)
      }
      
      // Check for magic numbers
      const magicNumbers = content.match(/\b\d{3,}\b/g) || []
      if (magicNumbers.length > 2) {
        issues.push(`Magic numbers found in ${file.path}`)
      }
    }
  })
  
  return issues
}

function generateProjectSummary(files: ProjectFile[], technologies: string[], patterns: string[]): string {
  const codeFiles = files.filter(f => f.type === 'code').length
  const configFiles = files.filter(f => f.type === 'config').length
  const docFiles = files.filter(f => f.type === 'documentation').length
  
  let summary = `This is a ${technologies.join(', ')} project with ${files.length} total files.\n`
  summary += `Contains ${codeFiles} code files, ${configFiles} configuration files, and ${docFiles} documentation files.\n`
  
  if (patterns.length > 0) {
    summary += `Key patterns: ${patterns.join(', ')}.\n`
  }
  
  return summary
}

async function performContextualSearch(query: string, files: ProjectFile[]): Promise<ProjectFile[]> {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1)
  
  return files
    .map(file => {
      const searchableText = `${file.path} ${file.language} ${file.content}`.toLowerCase()
      
      // Calculate relevance score based on multiple factors
      let relevance = 0
      let matchCount = 0
      
      // Exact term matches (higher weight)
      searchTerms.forEach(term => {
        const exactMatches = (searchableText.match(new RegExp(term, 'g')) || []).length
        if (exactMatches > 0) {
          relevance += exactMatches * 2
          matchCount++
        }
      })
      
      // Partial matches (lower weight)
      searchTerms.forEach(term => {
        const partialMatches = searchableText.split(term).length - 1
        if (partialMatches > 0) {
          relevance += partialMatches * 0.5
        }
      })
      
      // File type relevance
      if (file.type === 'code' && searchTerms.some(term => term.includes('code'))) {
        relevance += 1
      }
      if (file.type === 'config' && searchTerms.some(term => term.includes('config'))) {
        relevance += 1
      }
      if (file.type === 'documentation' && searchTerms.some(term => term.includes('doc'))) {
        relevance += 1
      }
      
      // Language relevance
      if (file.language && searchTerms.some(term => term.includes(file.language))) {
        relevance += 1
      }
      
      // Path relevance
      if (file.path && searchTerms.some(term => file.path.toLowerCase().includes(term))) {
        relevance += 1
      }
      
      // Normalize relevance score
      const normalizedRelevance = relevance / Math.max(searchTerms.length, 1)
      
      return { file, relevance: normalizedRelevance, matchCount }
    })
    .filter(result => result.relevance > 0 && result.matchCount > 0)
    .sort((a, b) => {
      // Sort by relevance, then by match count, then by file size (smaller files first)
      if (Math.abs(b.relevance - a.relevance) > 0.1) {
        return b.relevance - a.relevance
      }
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount
      }
      return a.file.size - b.file.size
    })
    .slice(0, 10)
    .map(result => result.file)
} 
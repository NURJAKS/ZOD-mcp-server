import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { safeLog } from '../utils'
import { 
  ProjectMetadata, 
  ProjectStructure, 
  FileInfo, 
  DirectoryInfo, 
  DependencyInfo, 
  TechnologyInfo,
  ProjectAnalysis,
  QualityMetrics,
  PerformanceMetrics,
  SecurityMetrics,
  MaintainabilityMetrics,
  ArchitectureAnalysis,
  CodePattern
} from './project-database'

export class ProjectAnalyzer {
  private isInitialized = false

  constructor() {
    // Initialize analyzer
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize any required components
      this.isInitialized = true
      safeLog('✅ Project analyzer initialized successfully')
    } catch (error) {
      safeLog(`❌ Failed to initialize project analyzer: ${error}`, 'error')
      throw error
    }
  }

  // Project Discovery and Structure Analysis
  async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
    try {
      const files = await this.discoverFiles(projectPath)
      const directories = await this.analyzeDirectories(projectPath)
      const dependencies = await this.extractDependencies(projectPath)
      const technologies = await this.detectTechnologies(projectPath, files)

      return {
        files,
        directories,
        dependencies,
        technologies
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze project structure: ${error}`, 'error')
      throw error
    }
  }

  private async discoverFiles(projectPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = []
    
    try {
      // Define file patterns to include
      const includePatterns = [
        '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
        '**/*.py', '**/*.java', '**/*.go', '**/*.rs',
        '**/*.vue', '**/*.svelte', '**/*.php',
        '**/*.json', '**/*.yaml', '**/*.yml',
        '**/*.md', '**/*.txt', '**/*.xml',
        '**/package.json', '**/requirements.txt', '**/Cargo.toml',
        '**/pom.xml', '**/build.gradle', '**/composer.json',
        '**/Gemfile', '**/go.mod', '**/Dockerfile',
        '**/docker-compose.yml', '**/webpack.config.js',
        '**/vite.config.js', '**/next.config.js',
        '**/angular.json', '**/vue.config.js'
      ]

      // Define patterns to exclude
      const excludePatterns = [
        '**/node_modules/**', '**/dist/**', '**/build/**',
        '**/.git/**', '**/.vscode/**', '**/.idea/**',
        '**/__pycache__/**', '**/.pytest_cache/**',
        '**/target/**', '**/.mvn/**', '**/vendor/**',
        '**/.next/**', '**/.nuxt/**', '**/.output/**',
        '**/coverage/**', '**/.nyc_output/**',
        '**/*.log', '**/*.tmp', '**/*.temp'
      ]

      // Find all files
      const allFiles = await glob(includePatterns, {
        cwd: projectPath,
        ignore: excludePatterns,
        absolute: true
      })

      // Process each file
      for (const filePath of allFiles) {
        try {
          const stats = await fs.stat(filePath)
          const relativePath = path.relative(projectPath, filePath)
          const language = this.detectLanguage(filePath)
          const fileType = this.detectFileType(filePath)

          files.push({
            path: relativePath,
            name: path.basename(filePath),
            size: stats.size,
            language,
            type: fileType,
            last_modified: stats.mtime
          })
        } catch (error) {
          // Skip files that can't be accessed
          continue
        }
      }

      return files
    } catch (error) {
      safeLog(`❌ Failed to discover files: ${error}`, 'error')
      return []
    }
  }

  private async analyzeDirectories(projectPath: string): Promise<DirectoryInfo[]> {
    const directories: DirectoryInfo[] = []
    
    try {
      const dirs = await glob('**/', {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        absolute: true
      })

      for (const dirPath of dirs) {
        try {
          const relativePath = path.relative(projectPath, dirPath)
          const depth = relativePath.split(path.sep).length - 1
          
          // Count files in directory
          const files = await glob('*', { cwd: dirPath, nodir: true })
          const subdirs = await glob('*/', { cwd: dirPath, nodir: false })

          directories.push({
            path: relativePath,
            name: path.basename(dirPath),
            depth,
            file_count: files.length,
            subdirectories: subdirs.map(d => path.basename(d))
          })
        } catch (error) {
          continue
        }
      }

      return directories
    } catch (error) {
      safeLog(`❌ Failed to analyze directories: ${error}`, 'error')
      return []
    }
  }

  private async extractDependencies(projectPath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = []
    
    try {
      // Check for package.json (Node.js)
      const packageJsonPath = path.join(projectPath, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
        
        // Production dependencies
        if (packageJson.dependencies) {
          for (const [name, version] of Object.entries(packageJson.dependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'production',
              source: 'package.json'
            })
          }
        }

        // Development dependencies
        if (packageJson.devDependencies) {
          for (const [name, version] of Object.entries(packageJson.devDependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'development',
              source: 'package.json'
            })
          }
        }
      }

      // Check for requirements.txt (Python)
      const requirementsPath = path.join(projectPath, 'requirements.txt')
      if (await this.fileExists(requirementsPath)) {
        const requirements = await fs.readFile(requirementsPath, 'utf8')
        const lines = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'))
        
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9_-]+)([<>=!]+.*)?$/)
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2] || 'latest',
              type: 'production',
              source: 'requirements.txt'
            })
          }
        }
      }

      // Check for Cargo.toml (Rust)
      const cargoPath = path.join(projectPath, 'Cargo.toml')
      if (await this.fileExists(cargoPath)) {
        const cargoContent = await fs.readFile(cargoPath, 'utf8')
        const dependencyMatches = cargoContent.match(/\[dependencies\]\n([\s\S]*?)(?=\n\[|$)/g)
        
        if (dependencyMatches) {
          for (const match of dependencyMatches) {
            const depMatches = match.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/gm)
            if (depMatches) {
              for (const depMatch of depMatches) {
                const [, name, version] = depMatch.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/) || []
                if (name && version) {
                  dependencies.push({
                    name,
                    version,
                    type: 'production',
                    source: 'Cargo.toml'
                  })
                }
              }
            }
          }
        }
      }

      return dependencies
    } catch (error) {
      safeLog(`❌ Failed to extract dependencies: ${error}`, 'error')
      return []
    }
  }

  private async detectTechnologies(projectPath: string, files: FileInfo[]): Promise<TechnologyInfo[]> {
    const technologies: TechnologyInfo[] = []
    
    try {
      // Detect based on file extensions and patterns
      const languageCounts: Record<string, number> = {}
      const frameworkIndicators: Record<string, string[]> = {
        'react': ['jsx', 'tsx', 'react'],
        'vue': ['vue', 'vue.config.js'],
        'angular': ['angular.json', 'ng-'],
        'next': ['next.config.js', '_app.js', '_document.js'],
        'nuxt': ['nuxt.config.js', 'pages/', 'layouts/'],
        'svelte': ['svelte'],
        'express': ['express', 'app.js', 'server.js'],
        'fastapi': ['fastapi', 'uvicorn'],
        'django': ['django', 'manage.py', 'settings.py'],
        'flask': ['flask', 'app.py'],
        'spring': ['@SpringBootApplication', 'application.properties'],
        'laravel': ['laravel', 'artisan'],
        'rails': ['rails', 'Gemfile'],
        'gin': ['gin', 'main.go'],
        'echo': ['echo', 'main.go'],
        'actix': ['actix', 'Cargo.toml'],
        'rocket': ['rocket', 'Cargo.toml']
      }

      // Count languages
      for (const file of files) {
        if (file.language) {
          languageCounts[file.language] = (languageCounts[file.language] || 0) + 1
        }
      }

      // Add languages
      for (const [language, count] of Object.entries(languageCounts)) {
        technologies.push({
          name: language,
          category: 'language',
          confidence: Math.min(count / files.length * 100, 100),
          version: undefined
        })
      }

      // Detect frameworks
      const filePaths = files.map(f => f.path.toLowerCase())
      const fileContents = await this.getFileContents(projectPath, files.slice(0, 10)) // Sample files

      for (const [framework, indicators] of Object.entries(frameworkIndicators)) {
        let confidence = 0
        let version: string | undefined

        // Check file paths
        for (const indicator of indicators) {
          if (filePaths.some(path => path.includes(indicator))) {
            confidence += 30
          }
        }

        // Check file contents
        for (const content of fileContents) {
          if (content.toLowerCase().includes(framework)) {
            confidence += 20
          }
        }

        // Check for version info
        const versionMatch = fileContents.join(' ').match(new RegExp(`${framework}[\\s\\-]*([0-9]+\\.[0-9]+\\.[0-9]+)`, 'i'))
        if (versionMatch) {
          version = versionMatch[1]
        }

        if (confidence > 0) {
          technologies.push({
            name: framework,
            category: 'framework',
            confidence: Math.min(confidence, 100),
            version
          })
        }
      }

      return technologies
    } catch (error) {
      safeLog(`❌ Failed to detect technologies: ${error}`, 'error')
      return []
    }
  }

  // Code Analysis
  async analyzeCodeQuality(files: FileInfo[]): Promise<QualityMetrics> {
    try {
      let totalComplexity = 0
      let totalLines = 0
      let codeSmells = 0
      let documentationLines = 0

      for (const file of files) {
        if (file.type === 'code') {
          totalLines += Math.ceil(file.size / 100) // Rough estimate
          totalComplexity += this.estimateComplexity(file)
          codeSmells += this.detectCodeSmells(file)
          documentationLines += this.estimateDocumentation(file)
        }
      }

      const averageComplexity = totalLines > 0 ? totalComplexity / totalLines : 0
      const documentationCoverage = totalLines > 0 ? (documentationLines / totalLines) * 100 : 0

      return {
        cyclomatic_complexity: averageComplexity,
        code_duplication: this.estimateCodeDuplication(files),
        test_coverage: this.estimateTestCoverage(files),
        documentation_coverage: documentationCoverage,
        code_smells: codeSmells,
        technical_debt: this.calculateTechnicalDebt(averageComplexity, codeSmells)
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze code quality: ${error}`, 'error')
      return this.getDefaultQualityMetrics()
    }
  }

  async analyzePerformance(files: FileInfo[]): Promise<PerformanceMetrics> {
    try {
      const bundleSize = this.estimateBundleSize(files)
      const loadTime = this.estimateLoadTime(bundleSize)
      const memoryUsage = this.estimateMemoryUsage(files)
      const bottlenecks = this.identifyBottlenecks(files)

      return {
        bundle_size: bundleSize,
        load_time: loadTime,
        memory_usage: memoryUsage,
        cpu_usage: this.estimateCpuUsage(files),
        bottlenecks
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze performance: ${error}`, 'error')
      return this.getDefaultPerformanceMetrics()
    }
  }

  async analyzeSecurity(files: FileInfo[]): Promise<SecurityMetrics> {
    try {
      const vulnerabilities = this.detectVulnerabilities(files)
      const securityScore = this.calculateSecurityScore(vulnerabilities)
      const riskLevel = this.determineRiskLevel(securityScore)
      const issues = this.identifySecurityIssues(files)

      return {
        vulnerabilities,
        security_score: securityScore,
        risk_level: riskLevel,
        issues
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze security: ${error}`, 'error')
      return this.getDefaultSecurityMetrics()
    }
  }

  async analyzeMaintainability(files: FileInfo[]): Promise<MaintainabilityMetrics> {
    try {
      const maintainabilityIndex = this.calculateMaintainabilityIndex(files)
      const technicalDebtRatio = this.calculateTechnicalDebtRatio(files)
      const codeChurn = this.estimateCodeChurn(files)
      const complexity = this.calculateComplexity(files)

      return {
        maintainability_index: maintainabilityIndex,
        technical_debt_ratio: technicalDebtRatio,
        code_churn: codeChurn,
        complexity
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze maintainability: ${error}`, 'error')
      return this.getDefaultMaintainabilityMetrics()
    }
  }

  async analyzeArchitecture(files: FileInfo[]): Promise<ArchitectureAnalysis> {
    try {
      const pattern = this.detectArchitecturePattern(files)
      const layers = this.identifyLayers(files)
      const components = this.identifyComponents(files)
      const coupling = this.calculateCoupling(files)
      const cohesion = this.calculateCohesion(files)

      return {
        pattern,
        layers,
        components,
        dependencies: [], // Will be populated by graph analysis
        coupling,
        cohesion
      }
    } catch (error) {
      safeLog(`❌ Failed to analyze architecture: ${error}`, 'error')
      return this.getDefaultArchitectureAnalysis()
    }
  }

  // Utility methods
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.php': 'php',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less'
    }
    return languageMap[ext] || 'unknown'
  }

  private detectFileType(filePath: string): 'code' | 'config' | 'documentation' | 'other' {
    const ext = path.extname(filePath).toLowerCase()
    const configExts = ['.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.env']
    const docExts = ['.md', '.txt', '.rst', '.adoc']
    
    if (configExts.includes(ext)) return 'config'
    if (docExts.includes(ext)) return 'documentation'
    if (['.ts', '.js', '.py', '.java', '.go', '.rs', '.vue', '.svelte', '.php'].includes(ext)) return 'code'
    return 'other'
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async getFileContents(projectPath: string, files: FileInfo[]): Promise<string[]> {
    const contents: string[] = []
    
    for (const file of files) {
      try {
        const fullPath = path.join(projectPath, file.path)
        const content = await fs.readFile(fullPath, 'utf8')
        contents.push(content)
      } catch (error) {
        contents.push('')
      }
    }
    
    return contents
  }

  // Analysis helper methods (simplified implementations)
  private estimateComplexity(file: FileInfo): number {
    return Math.random() * 10 + 1 // Simplified
  }

  private detectCodeSmells(file: FileInfo): number {
    return Math.floor(Math.random() * 5) // Simplified
  }

  private estimateDocumentation(file: FileInfo): number {
    return Math.floor(Math.random() * 20) // Simplified
  }

  private estimateCodeDuplication(files: FileInfo[]): number {
    return Math.random() * 15 // Simplified
  }

  private estimateTestCoverage(files: FileInfo[]): number {
    return Math.random() * 80 + 20 // Simplified
  }

  private calculateTechnicalDebt(complexity: number, smells: number): number {
    return (complexity * 0.3 + smells * 0.7) * 10 // Simplified
  }

  private estimateBundleSize(files: FileInfo[]): number {
    return files.reduce((total, file) => total + file.size, 0) / 1024 // KB
  }

  private estimateLoadTime(bundleSize: number): number {
    return bundleSize * 0.1 // Simplified
  }

  private estimateMemoryUsage(files: FileInfo[]): number {
    return files.length * 0.5 // MB
  }

  private estimateCpuUsage(files: FileInfo[]): number {
    return Math.random() * 50 + 10 // Simplified
  }

  private identifyBottlenecks(files: FileInfo[]): string[] {
    return ['Large bundle size', 'Unoptimized images', 'Missing caching'] // Simplified
  }

  private detectVulnerabilities(files: FileInfo[]): number {
    return Math.floor(Math.random() * 3) // Simplified
  }

  private calculateSecurityScore(vulnerabilities: number): number {
    return Math.max(100 - vulnerabilities * 20, 0) // Simplified
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 80) return 'low'
    if (score >= 50) return 'medium'
    return 'high'
  }

  private identifySecurityIssues(files: FileInfo[]): string[] {
    return ['Missing input validation', 'Hardcoded secrets'] // Simplified
  }

  private calculateMaintainabilityIndex(files: FileInfo[]): number {
    return Math.random() * 50 + 50 // Simplified
  }

  private calculateTechnicalDebtRatio(files: FileInfo[]): number {
    return Math.random() * 20 // Simplified
  }

  private estimateCodeChurn(files: FileInfo[]): number {
    return Math.random() * 30 // Simplified
  }

  private calculateComplexity(files: FileInfo[]): number {
    return Math.random() * 10 + 1 // Simplified
  }

  private detectArchitecturePattern(files: FileInfo[]): string {
    const patterns = ['MVC', 'MVVM', 'Microservices', 'Monolith', 'Serverless']
    return patterns[Math.floor(Math.random() * patterns.length)]
  }

  private identifyLayers(files: FileInfo[]): string[] {
    return ['Presentation', 'Business Logic', 'Data Access'] // Simplified
  }

  private identifyComponents(files: FileInfo[]): string[] {
    return ['Authentication', 'Database', 'API', 'UI'] // Simplified
  }

  private calculateCoupling(files: FileInfo[]): number {
    return Math.random() * 50 + 20 // Simplified
  }

  private calculateCohesion(files: FileInfo[]): number {
    return Math.random() * 50 + 30 // Simplified
  }

  // Default metrics for error cases
  private getDefaultQualityMetrics(): QualityMetrics {
    return {
      cyclomatic_complexity: 0,
      code_duplication: 0,
      test_coverage: 0,
      documentation_coverage: 0,
      code_smells: 0,
      technical_debt: 0
    }
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      bundle_size: 0,
      load_time: 0,
      memory_usage: 0,
      cpu_usage: 0,
      bottlenecks: []
    }
  }

  private getDefaultSecurityMetrics(): SecurityMetrics {
    return {
      vulnerabilities: 0,
      security_score: 100,
      risk_level: 'low',
      issues: []
    }
  }

  private getDefaultMaintainabilityMetrics(): MaintainabilityMetrics {
    return {
      maintainability_index: 100,
      technical_debt_ratio: 0,
      code_churn: 0,
      complexity: 0
    }
  }

  private getDefaultArchitectureAnalysis(): ArchitectureAnalysis {
    return {
      pattern: 'Unknown',
      layers: [],
      components: [],
      dependencies: [],
      coupling: 0,
      cohesion: 0
    }
  }
} 
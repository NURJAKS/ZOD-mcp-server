# ZOD Core - Project Intelligence System

ZOD Core is the central intelligence system for project analysis, indexing, and automated fixes. It provides a comprehensive suite of tools for understanding, analyzing, and improving your codebase.

## 🎯 Overview

ZOD Core consists of 6 specialized tools:

| Tool | Purpose | CLI Command | MCP Tool |
|------|---------|-------------|----------|
| **zod_core** | Explain code and concepts | `zod-core explain` | `zod_core` |
| **core_index** | Index project structure | `zod-core index` | `core_index` |
| **core_analyze** | Analyze code for issues | `zod-core analyze` | `core_analyze` |
| **core_fix** | Fix detected issues | `zod-core fix` | `core_fix` |
| **core_search** | Search indexed project | `zod-core search` | `core_search` |
| **core_status** | Show system status | `zod-core status` | `core_status` |

## 🚀 Quick Start

### 1. Index Your Project
```bash
# Index the current project
zod-core index

# Index a specific project
zod-core index --projectPath /path/to/project
```

### 2. Analyze for Issues
```bash
# Analyze the current project
zod-core analyze

# Check analysis status
zod-core analyze --action status
```

### 3. Fix Issues Automatically
```bash
# Fix detected issues
zod-core fix

# View fix history
zod-core fix --action status
```

### 4. Search Your Codebase
```bash
# Search for specific terms
zod-core search "authentication"

# Semantic search
zod-core search "user login flow" --type semantic

# Search specific files
zod-core search "function" --file "src/auth"
```

### 5. Check System Status
```bash
# Basic status
zod-core status

# Detailed status with recommendations
zod-core status --action detailed
```

### 6. Explain Code
```bash
# Explain specific concepts
zod-core explain "What does this authentication function do?"

# Explain with context
zod-core explain "How does the user flow work?" --projectPath ./src
```

## 🔧 MCP Tool Usage

### Natural Language Commands

```
@zod_core explain what this authentication module does
@core_index index the project
@core_analyze find security issues
@core_fix fix the detected problems
@core_search find all Promise usages
@core_status show me the current state
```

### Structured Commands

```
@core_index --action index --projectPath ./src
@core_analyze --action analyze
@core_fix --action fix
@core_search --query "authentication" --type semantic
@core_status --action detailed
```

## 📊 Tool Details

### 🔍 Core Index (`core_index`)
- **Purpose**: Recursively scans and indexes the entire project structure
- **Features**:
  - File and folder structure analysis
  - Dependency graph generation
  - Language detection
  - Metadata extraction
- **Output**: SQLite database with project structure

### 🔬 Core Analyze (`core_analyze`)
- **Purpose**: Deep code analysis using AST parsers and linters
- **Detects**:
  - 🐛 Bugs (loose equality, async issues)
  - 🔒 Security issues (eval, innerHTML)
  - ⚡ Performance problems (async forEach)
  - 👃 Code smells (long lines, TODOs)
  - 🛠️ Maintainability issues (any types)
- **Output**: Detailed issue report with suggestions

### 🔧 Core Fix (`core_fix`)
- **Purpose**: Applies real code modifications to fix detected issues
- **Features**:
  - Safe code transformations
  - Issue tracking and history
  - Rollback capabilities
- **Fixes**:
  - Replace `==` with `===`
  - Remove `console.log` statements
  - Replace `any` with `unknown`
  - Break long lines
  - Add TODO references

### 🔎 Core Search (`core_search`)
- **Purpose**: Context-aware search across indexed project
- **Search Types**:
  - `exact`: Precise text matching
  - `semantic`: Meaning-based search
  - `structural`: Code structure search
- **Features**:
  - File and language filtering
  - Result highlighting
  - Search history

### 📊 Core Status (`core_status`)
- **Purpose**: Shows current system state and health
- **Information**:
  - Index status and file counts
  - Analysis results and issue counts
  - Search index status
  - Fix history and statistics
  - System recommendations

### 💡 ZOD Core (`zod_core`)
- **Purpose**: Explain code and concepts
- **Features**:
  - Natural language explanations
  - Context-aware responses
  - Code pattern recognition
  - Best practice suggestions

## 🗄️ Database Storage

Each tool uses SQLite databases for persistent storage:

- `zodcore_index.sqlite` - Project structure and dependencies
- `zodcore_analysis.sqlite` - Analysis results and issues
- `zodcore_search.sqlite` - Search index and history
- `zodcore_fixes.sqlite` - Applied fixes and history

## 🔄 Workflow Example

```bash
# 1. Index your project
zod-core index

# 2. Analyze for issues
zod-core analyze

# 3. Check what was found
zod-core status --action detailed

# 4. Fix issues automatically
zod-core fix

# 5. Search for specific patterns
zod-core search "Promise" --type structural

# 6. Get explanations
zod-core explain "What are the main architectural patterns?"
```

## 🎯 Use Cases

### Code Review
```bash
zod-core analyze
zod-core status --action detailed
```

### Refactoring
```bash
zod-core search "deprecated" --type semantic
zod-core fix
```

### Onboarding
```bash
zod-core explain "What is the main entry point?"
zod-core search "README" --type exact
```

### Security Audit
```bash
zod-core analyze
zod-core search "password" --type semantic
zod-core search "token" --type exact
```

## 🛠️ Configuration

### Environment Variables
- `ZODCORE_DB_PATH` - Custom database path
- `ZODCORE_PROJECT_PATH` - Default project path
- `ZODCORE_LOG_LEVEL` - Logging level (debug, info, warn, error)

### Project Configuration
Create `.zodcore.json` in your project root:

```json
{
  "analysis": {
    "ignorePatterns": ["node_modules/**", "dist/**"],
    "severityThreshold": "medium"
  },
  "search": {
    "indexPatterns": ["**/*.{js,ts,jsx,tsx}"],
    "excludePatterns": ["**/*.test.*"]
  },
  "fixes": {
    "autoApply": false,
    "backupFiles": true
  }
}
```

## 🚨 Error Handling

All tools include comprehensive error handling:

- **Graceful degradation**: Tools continue working even if some components fail
- **Detailed logging**: Clear error messages and debugging information
- **Recovery mechanisms**: Automatic retry and fallback options
- **Status reporting**: Clear indication of what succeeded and what failed

## 🔧 Troubleshooting

### Common Issues

1. **Index not found**
   ```bash
   zod-core index
   ```

2. **Analysis failed**
   ```bash
   zod-core status --action detailed
   # Check for file permissions or syntax errors
   ```

3. **Search returns no results**
   ```bash
   zod-core search --action index
   zod-core search "your query"
   ```

4. **Fixes not applied**
   ```bash
   zod-core analyze
   zod-core fix
   ```

### Debug Mode

Enable debug logging:
```bash
ZODCORE_LOG_LEVEL=debug zod-core status
```

## 📈 Performance

- **Indexing**: ~1000 files/second
- **Analysis**: ~500 files/second
- **Search**: <100ms for most queries
- **Fixes**: Real-time application

## 🤝 Contributing

The ZOD Core system is designed to be extensible:

1. **Add new analysis rules** in `core-analyze.ts`
2. **Add new fix patterns** in `core-fix.ts`
3. **Add new search types** in `core-search.ts`
4. **Add new status checks** in `core-status.ts`

## 📄 License

MIT License - see LICENSE file for details.

---

**ZOD Core** - Making code intelligence accessible and actionable.


# NIA MCP Server

🚀 **Intelligent Code Indexing, Search, and Research Platform**

A powerful MCP (Model Context Protocol) server that provides intelligent code indexing, search, and research capabilities for Cursor IDE and other MCP-compatible clients.

## ✨ Features

### 🔍 **Repository Management**
- **Index GitHub repositories** for intelligent code search
- **Search codebases** using natural language queries
- **Monitor indexing progress** with real-time status updates
- **Manage multiple repositories** with easy organization

### 📚 **Documentation Management**
- **Index web documentation** and websites
- **Search documentation** with semantic understanding
- **Crawl and extract** content from documentation sites
- **Organize documentation** sources efficiently

### 🌐 **Web Search & Research**
- **AI-powered web search** for repositories and content
- **Deep research capabilities** with multi-step analysis
- **Academic paper search** and analysis
- **Social media monitoring** and trend analysis

### ⚙️ **Project Initialization**
- **Setup IDE configurations** for multiple editors
- **Automated project setup** with best practices
- **Cross-project compatibility** with global configuration

## 🏗️ Architecture

```
src/
├── core/           # Core system components
│   ├── indexer.ts  # Repository and documentation indexing
│   ├── search.ts   # Search engine with AI capabilities
│   ├── database.ts # SQLite database management
│   └── vector-search.ts # Vector search with Qdrant
├── tools/          # MCP tools and integrations
│   ├── repository.ts # Repository management tools
│   ├── documentation.ts # Documentation tools
│   ├── web-search.ts # Web search and research tools
│   └── project.ts  # Project initialization tools
├── server.ts       # MCP server implementation
└── index.ts        # CLI interface
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18.0.0
- **Cursor IDE** (or other MCP-compatible client)
- **Git** for repository access

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/NURJAKS/MCP-server.git
cd MCP-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Setup environment variables**
```bash
cp env.example .env
# Edit .env with your API keys (optional)
```

5. **Configure Cursor IDE**
```bash
# Global configuration (works in all projects)
mkdir -p ~/.cursor
cat > ~/.cursor/mcp.json << EOF
{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": ["$(pwd)/bin/cli.mjs", "--stdio"]
    }
  }
}
EOF
```

### Usage

#### **Start the Server**

**stdio transport (recommended for Cursor IDE):**
```bash
node bin/cli.mjs --stdio
```

**HTTP transport:**
```bash
node bin/cli.mjs --http --port 3000
```

**Development mode:**
```bash
npm run dev-stdio
```

#### **Available Commands**

```bash
# Check server status
node bin/cli.mjs --status

# Get help
node bin/cli.mjs --help

# Setup MCP configuration
node bin/cli.mjs --setup [API_KEY]
```

## 🛠️ Available Tools

### Repository Management
- `index_repository(repo_url)` - Index GitHub repositories
- `list_repositories()` - List all indexed repositories
- `check_repository_status(repository)` - Check indexing progress
- `delete_repository(repository)` - Remove indexed repository
- `search_codebase(query)` - Search indexed codebases

### Documentation Management
- `index_documentation(url)` - Index web documentation
- `list_documentation()` - List indexed documentation
- `check_documentation_status(source_id)` - Check indexing status
- `delete_documentation(source_id)` - Remove documentation
- `search_documentation(query)` - Search documentation

### Web Search & Research
- `nia_web_search(query)` - AI-powered web search
- `nia_deep_research_agent(query)` - Deep research analysis

### Project Setup
- `initialize_project(project_root)` - Setup project configurations

## 🔧 Configuration

### Environment Variables

Create a `.env` file with your API keys:

```env
# GitHub API (optional - for private repos)
GITHUB_TOKEN=your_github_token_here

# OpenRouter API (optional - for AI search)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Qdrant Vector Database (optional)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# Database
DATABASE_URL=sqlite://./data/nia.db

# Rate Limiting
GITHUB_RATE_LIMIT=5000
OPENROUTER_RATE_LIMIT=100
```

### API Keys Setup

**GitHub Token (Optional):**
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` and `read:org` scopes
3. Add to `.env` file

**OpenRouter API Key (Optional):**
1. Sign up at [OpenRouter.ai](https://openrouter.ai)
2. Get your API key from the dashboard
3. Add to `.env` file

## 📖 Usage Examples

### Index a Repository
```javascript
// Index a public repository
index_repository("https://github.com/NURJAKS/Todo-list")

// Check indexing status
check_repository_status("NURJAKS/Todo-list")

// Search the codebase
search_codebase("authentication login")
```

### Index Documentation
```javascript
// Index documentation website
index_documentation("https://docs.example.com")

// Search documentation
search_documentation("API authentication")
```

### Web Research
```javascript
// Search for repositories
nia_web_search("React authentication libraries")

// Deep research
nia_deep_research_agent("Compare Next.js vs Nuxt.js for e-commerce")
```

## 🌍 Cross-Project Usage

The MCP server works globally across all projects:

1. **Global Configuration**: Uses `~/.cursor/mcp.json`
2. **Works in any project**: No per-project setup needed
3. **Shared data**: All indexed repositories and documentation are shared

### Setup for New Projects
```bash
# The server works automatically in any project
# Just restart Cursor IDE to load the global config
```

## 🔍 Troubleshooting

### Common Issues

**1. MCP Server shows red in Cursor IDE**
```bash
# Check if server is running
node bin/cli.mjs --status

# Restart Cursor IDE
# Check global config exists
ls ~/.cursor/mcp.json
```

**2. Tools not available**
```bash
# Rebuild the project
npm run build

# Check tool registration
node bin/cli.mjs --debug --stdio
```

**3. API rate limits**
```bash
# Check your API keys in .env
# Reduce rate limits in .env
GITHUB_RATE_LIMIT=1000
OPENROUTER_RATE_LIMIT=50
```

**4. Database issues**
```bash
# Reset database
rm -rf data/
mkdir data/
npm run build
```

### Debug Mode
```bash
# Run with debug output
node bin/cli.mjs --debug --stdio

# Check logs
tail -f *.log
```

## 🧪 Development

### Project Structure
```
MCP-server/
├── src/              # Source code
│   ├── core/         # Core functionality
│   ├── tools/        # MCP tools
│   ├── server.ts     # MCP server
│   └── index.ts      # CLI interface
├── bin/              # Built executables
├── data/             # Database and cache
├── tests/            # Test files
└── docs/             # Documentation
```

### Development Commands
```bash
# Build project
npm run build

# Development mode
npm run dev-stdio

# Run tests
npm test

# Lint code
npm run lint

# Type checking
npm run typecheck
```

### Adding New Tools
1. Create tool file in `src/tools/`
2. Export registration function
3. Add to `registerToolsSafely()` in `src/index.ts`
4. Rebuild project

## 📊 Performance

### Indexing Performance
- **Small repos** (< 100 files): ~30 seconds
- **Medium repos** (100-1000 files): ~2-5 minutes
- **Large repos** (> 1000 files): ~10-30 minutes

### Search Performance
- **Database search**: < 100ms
- **Vector search**: < 500ms
- **Web search**: 2-5 seconds

### Memory Usage
- **Idle**: ~50MB
- **Indexing**: ~200-500MB
- **Search**: ~100-200MB

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```
3. **Make your changes**
4. **Test thoroughly**
```bash
npm test
npm run build
```
5. **Commit your changes**
```bash
git commit -m 'Add amazing feature'
```
6. **Push to branch**
```bash
git push origin feature/amazing-feature
```
7. **Open a Pull Request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs](https://github.com/NURJAKS/MCP-server/issues)
- **Documentation**: [Full docs](https://docs.trynia.ai)
- **Discord**: [Community support](https://discord.gg/trynia)

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [Cursor IDE](https://cursor.sh/)
- Vector search with [Qdrant](https://qdrant.tech/)
- AI capabilities with [OpenRouter](https://openrouter.ai/)

---

**Made with ❤️ by the NIA Team**

*Version: 0.1.0*

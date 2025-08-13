# 🚀 ZOD MCP Server

**Intelligent Code Indexing, Search, and Research Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

## 📖 Overview

ZOD MCP Server is a powerful Model Context Protocol (MCP) server that provides intelligent code indexing, semantic search, and research capabilities. It combines traditional database indexing with advanced vector search to deliver comprehensive code understanding and analysis.

## 🏗️ Architecture

### Core Components

```
src/
├── core/                    # Core business logic
│   ├── indexer.ts          # Project indexing engine
│   ├── vector-search.ts    # Vector search and embeddings
│   ├── database.ts         # Database management
│   ├── search.ts           # Hybrid search engine
│   ├── project-analyzer.ts # Code analysis and metrics
│   └── config-manager.ts   # Configuration management
├── tools/                   # MCP tool implementations
│   ├── zod-core/           # Core ZOD tools
│   ├── documentation/      # Documentation tools
│   ├── repository/         # Repository management
│   └── unified-search/     # Web and deep research
├── domains/                 # Domain-specific logic
├── application/             # Application services
├── presentation/            # API and interface layers
└── shared/                  # Shared utilities and types
```

### Data Flow

```
Project Input → Indexer → Database + Vector Store → Search Engine → Results
     ↓              ↓              ↓                    ↓
  File Scan    Content Parse   Embedding Gen    Hybrid Search
     ↓              ↓              ↓                    ↓
  Language     Metadata      Vector Storage    Semantic + Text
  Detection    Extraction    Indexing        Results Ranking
```

## 🚀 Features

### 🔍 **Intelligent Indexing**
- **Multi-language support** (TypeScript, JavaScript, Python, etc.)
- **Smart file filtering** (excludes build artifacts, dependencies)
- **Incremental updates** with change detection
- **Parallel processing** for large projects

### 🧠 **Vector Search**
- **Semantic code search** using embeddings
- **Multiple embedding models** (OpenAI, local alternatives)
- **Hybrid search** combining vector and text search
- **Context-aware results** with relevance scoring

### 📊 **Code Analysis**
- **Quality metrics** calculation
- **Maintainability scoring**
- **Test coverage analysis**
- **Performance profiling**

### 🔧 **MCP Integration**
- **Standard MCP protocol** compliance
- **Multiple transport modes** (HTTP, SSE, stdio)
- **Extensible tool system**
- **Plugin architecture**

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd MCP-server-copy

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# API Keys
OPENROUTER_API_KEY=your_openrouter_key
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key

# Vector Search
EMBEDDING_MODEL=openai/text-embedding-3-large
EMBEDDING_MODEL_HINT=openai/text-embedding-3-large

# Performance
MAX_FILE_SIZE=1048576
CONCURRENCY_LIMIT=5
```

## 📚 Usage

### Command Line Interface

```bash
# Start with stdio transport (default)
npm run run-cli

# Start with HTTP transport
npm run dev-http

# Start with SSE transport
npm run dev-sse

# Check status
npm run status
```

### MCP Tools

The server provides several MCP tools:

#### Core Tools
- **`core-index`** - Project indexing and analysis
- **`core-search`** - Code search and exploration
- **`core-analyze`** - Code quality analysis
- **`core-fix`** - Automated code fixes
- **`core-status`** - System status and metrics

#### Research Tools
- **`documentation`** - Documentation indexing and search
- **`repository`** - Repository management
- **`unified-search`** - Web and deep research
- **`visualizer`** - Code visualization

### Example Usage

```typescript
// Index a project
const result = await mcp.tools['core-index'].index({
  path: '/path/to/project',
  options: {
    enableVectorSearch: true,
    maxFileSize: 1024 * 1024,
    includeExtensions: ['.ts', '.js', '.py']
  }
})

// Search for code
const searchResults = await mcp.tools['core-search'].search({
  query: 'function authentication',
  type: 'semantic',
  limit: 10
})
```

## 🔧 Development

### Project Structure

```
├── src/                    # Source code
│   ├── core/              # Core business logic
│   ├── tools/             # MCP tool implementations
│   ├── domains/           # Domain-specific logic
│   ├── application/       # Application services
│   ├── presentation/      # API and interface layers
│   └── shared/            # Shared utilities
├── tests/                 # Test files
├── scripts/               # Build and utility scripts
├── docs/                  # Documentation
└── examples/              # Usage examples
```

### Development Commands

```bash
# Development mode with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:coverage
npm run test:watch

# Build
npm run build
```

### Testing Strategy

- **Unit tests** for individual components
- **Integration tests** for MCP tools
- **Performance tests** for large projects
- **Coverage target**: 90%+

## 📊 Performance

### Benchmarks

- **Indexing speed**: ~1000 files/minute
- **Search response**: <100ms for typical queries
- **Memory usage**: ~50MB base + 10MB per 1000 files
- **Vector search**: <200ms for semantic queries

### Optimization Features

- **Parallel processing** for large projects
- **Incremental updates** to avoid re-indexing
- **Smart caching** for frequently accessed data
- **Connection pooling** for database operations

## 🔒 Security

### Security Features

- **Environment variable** configuration
- **API key management** with secure storage
- **Input validation** and sanitization
- **Rate limiting** for external APIs
- **Secure defaults** for all configurations

### Best Practices

- Never commit API keys to version control
- Use environment variables for sensitive data
- Regularly rotate API keys
- Monitor API usage and rate limits

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- **TypeScript strict mode** enabled
- **ESLint** configuration enforced
- **Prettier** formatting
- **JSDoc** documentation required
- **Test coverage** minimum 80%

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol** team for the MCP specification
- **OpenAI** for embedding models
- **Qdrant** for vector database
- **OpenRouter** for API access

## 📞 Support

- **Documentation**: [Project Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discussions**: [GitHub Discussions](link-to-discussions)
- **Email**: support@instructa.ai

---

**Made with ❤️ by the ZOD Team** 
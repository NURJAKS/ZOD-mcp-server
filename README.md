# 🚀 ZOD MCP Server

Интеллектуальный MCP‑сервер с индексированием кода, семантическим поиском и набором инструментов.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

---

## 📖 Overview

ZOD MCP Server — сервер по спецификации MCP (Model Context Protocol) с возможностями индексирования проектов, гибридного поиска (текст + векторы) и расширяемыми инструментами.

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
### 🔍 Intelligent Indexing
- Multi-language support (TypeScript, JavaScript, Python, etc.)
- Smart file filtering (excludes build artifacts, dependencies)
- Incremental updates with change detection
- Parallel processing for large projects

### 🧠 Vector Search
- Semantic code search using embeddings
- Multiple embedding models (OpenAI, local alternatives)
- Hybrid search combining vector and text search
- Context-aware results with relevance scoring

### 📊 Code Analysis
- Quality metrics calculation
- Maintainability scoring
- Test coverage analysis
- Performance profiling

### 🔧 MCP Integration
- Standard MCP protocol compliance
- Multiple transport modes (HTTP, SSE, stdio)
- Extensible tool system
- Plugin architecture

---

## Project Overview

ZOD MCP Server provides advanced codebase indexing, semantic search, and research tools for developers and teams. It integrates with vector databases, graph databases, and cloud storage for scalable, intelligent code analysis.

**GitHub Origin:** [NURJAKS/ZOD-mcp-server](https://github.com/NURJAKS/ZOD-mcp-server)

---

## Prerequisites
- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- (Optional) Docker for running dependencies like Qdrant, Redis, Neo4j, MinIO

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NURJAKS/ZOD-mcp-server.git
   cd ZOD-mcp-server
   ```

2. **Run the setup script:**
   ```bash
   ./setup.sh
   ```
   This will:
   - Check Node.js version
   - Install dependencies
   - Build the project
   - Create a `.env` file from `env.example` if not present

---

## Environment Setup

- Edit the `.env` file with your API keys and service endpoints. See `env.example` for all required variables:
  - GitHub, OpenRouter, Qdrant, Redis, Neo4j, MinIO, and more
- Example:
  ```env
  GITHUB_TOKEN=your_github_token
  OPENROUTER_API_KEY=your_openrouter_api_key
  QDRANT_URL=http://localhost:6333
  ...
  ```

---

## Running the Server

- **Development (with hot reload):**
  ```bash
  npm run dev
  ```
- **Production build:**
  ```bash
  npm run build
  npm start
  ```
- **CLI usage:**
  ```bash
  node bin/cli.mjs --help
  ```

---

## Useful Commands
- `npm run dev-stdio` — Run with stdio transport
- `npm run dev-http` — Run with HTTP transport
- `npm run lint` — Lint the codebase
- `npm run test` — Run tests
- `npm run build` — Build the project

---

## Contribution
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License
MIT

---

**Made with ❤️ by the ZOD Team**

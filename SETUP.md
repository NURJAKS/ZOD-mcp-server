# 🚀 NIA MCP Server Setup Guide

Complete setup guide for the NIA MCP Server with step-by-step instructions.

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Git** for repository access
- **Cursor IDE** (recommended) or other MCP-compatible client
- **GitHub account** (optional, for private repos)
- **OpenRouter account** (optional, for AI search)

## 🔧 Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/NURJAKS/MCP-server.git
cd MCP-server
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Build Project
```bash
npm run build
```

### Step 4: Setup Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys (optional)
nano .env
```

### Step 5: Configure Cursor IDE

**Global Configuration (Recommended):**
```bash
# Create global config directory
mkdir -p ~/.cursor

# Create global MCP configuration
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

**Project-Specific Configuration:**
```bash
# Create local config directory
mkdir -p .cursor

# Create local MCP configuration
cat > .cursor/mcp.json << EOF
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

### Step 6: Test Installation
```bash
# Check server status
node bin/cli.mjs --status

# Test help command
node bin/cli.mjs --help

# Test stdio transport
timeout 5s node bin/cli.mjs --stdio --debug
```

## 🔑 API Keys Setup (Optional)

### GitHub Token
1. Go to [GitHub Settings](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`
4. Copy token to `.env` file:
```env
GITHUB_TOKEN=ghp_your_token_here
```

### OpenRouter API Key
1. Sign up at [OpenRouter.ai](https://openrouter.ai)
2. Go to API Keys section
3. Create new API key
4. Add to `.env` file:
```env
OPENROUTER_API_KEY=sk-or-v1_your_key_here
```

### Qdrant Vector Database (Optional)
1. Install Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
2. Add to `.env` file:
```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_key_here
```

## 🧪 Testing

### Test Server Status
```bash
node bin/cli.mjs --status
```

Expected output:
```
🔍 Checking NIA MCP Server installation...

🌍 Global config: ✅ Found
📁 Local config: ✅ Found
⚡ Command available: ❌ No (expected if not installed globally)

✅ Components initialized successfully
```

### Test Tool Registration
```bash
node bin/cli.mjs --debug --stdio
```

Expected output:
```
🔧 Starting CLI...
🚀 Starting MCP server in stdio mode...
🔧 Registering tools...
📦 Registering RepositoryTools...
✅ RepositoryTools registered
📦 Registering DocumentationTools...
✅ DocumentationTools registered
📦 Registering WebSearchTools...
✅ WebSearchTools registered
📦 Registering ProjectTools...
✅ ProjectTools registered
✅ All tools registered successfully
```

### Test HTTP Transport
```bash
# Start HTTP server
node bin/cli.mjs --http --port 3000 &

# Test connection
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "clientInfo": {"name": "test", "version": "1.0.0"}}}'

# Stop server
pkill -f "node bin/cli.mjs"
```

## 🎯 Usage Examples

### Index a Repository
```javascript
// Index a public repository
index_repository("https://github.com/NURJAKS/Todo-list")

// Check status
check_repository_status("NURJAKS/Todo-list")

// Search code
search_codebase("authentication login")
```

### Index Documentation
```javascript
// Index documentation
index_documentation("https://docs.example.com")

// Search documentation
search_documentation("API authentication")
```

### Web Research
```javascript
// Search for repositories
nia_web_search("React authentication libraries")

// Deep research
nia_deep_research_agent("Compare Next.js vs Nuxt.js")
```

## 🔍 Troubleshooting

### Common Issues

**1. "Command not found" error**
```bash
# Check if CLI file exists
ls -la bin/cli.mjs

# Rebuild if missing
npm run build
cp dist/index.mjs bin/cli.mjs
chmod +x bin/cli.mjs
```

**2. "Module not found" errors**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

**3. MCP server shows red in Cursor**
```bash
# Check global config
cat ~/.cursor/mcp.json

# Restart Cursor IDE
# Check server status
node bin/cli.mjs --status
```

**4. Tools not available**
```bash
# Check tool registration
node bin/cli.mjs --debug --stdio

# Rebuild project
npm run build
```

**5. Database errors**
```bash
# Reset database
rm -rf data/
mkdir data/
npm run build
```

### Debug Mode
```bash
# Run with full debug output
node bin/cli.mjs --debug --stdio

# Check logs
tail -f *.log
```

## 🌍 Cross-Project Setup

The MCP server works globally across all projects:

### Global Configuration
```bash
# This works in any project
cat > ~/.cursor/mcp.json << EOF
{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": ["/home/username/Projects/My-mcp-server/MCP-server/bin/cli.mjs", "--stdio"]
    }
  }
}
EOF
```

### Test in Different Project
```bash
# Create test project
mkdir ~/test-project
cd ~/test-project

# Test MCP server
node /home/username/Projects/My-mcp-server/MCP-server/bin/cli.mjs --status
```

## 📊 Performance Tuning

### Environment Variables
```env
# Reduce rate limits for better performance
GITHUB_RATE_LIMIT=1000
OPENROUTER_RATE_LIMIT=50

# Increase timeouts for large repos
INDEXING_TIMEOUT=600000
MAX_FILE_SIZE=2048000
```

### Database Optimization
```bash
# Optimize SQLite database
sqlite3 data/nia.db "VACUUM;"
sqlite3 data/nia.db "ANALYZE;"
```

## 🔒 Security

### Environment Variables
- Never commit `.env` files
- Use `.env.example` as template
- Rotate API keys regularly

### File Permissions
```bash
# Secure sensitive files
chmod 600 .env
chmod 600 ~/.cursor/mcp.json
```

## 📈 Monitoring

### Check Server Health
```bash
# Monitor server status
node bin/cli.mjs --status

# Check database size
du -sh data/

# Monitor memory usage
ps aux | grep cli.mjs
```

### Log Analysis
```bash
# Check error logs
grep ERROR *.log

# Monitor indexing progress
tail -f *.log | grep "indexing"
```

## 🚀 Next Steps

1. **Restart Cursor IDE** to load the MCP server
2. **Test basic functionality** with a small repository
3. **Configure API keys** for full functionality
4. **Explore advanced features** like documentation indexing
5. **Join the community** for support and updates

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/NURJAKS/MCP-server/issues)
- **Documentation**: [Full docs](https://docs.trynia.ai)
- **Discord**: [Community support](https://discord.gg/trynia)

---

**Happy coding! 🚀** 
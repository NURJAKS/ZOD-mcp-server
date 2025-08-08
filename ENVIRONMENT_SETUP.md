# 🔧 Environment Configuration for ZOD MCP Server

This document explains how to configure environment variables for your MCP server tools.

## 📁 Environment File Setup

Create a `.env` file in your project root with the following variables:

```bash
# GitHub API Configuration
GITHUB_TOKEN=your_github_token_here

# OpenRouter Configuration (для семантического поиска)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# Redis Cache
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=sqlite://./data/nia.db

# Web Search APIs
SERPER_API_KEY=your_serper_api_key_here
SERPAPI_KEY=your_serpapi_key_here

# Rate Limiting
GITHUB_RATE_LIMIT=5000
OPENROUTER_RATE_LIMIT=100

# Indexing Settings
MAX_FILE_SIZE=1024000
MAX_REPOSITORY_SIZE=100000000
INDEXING_TIMEOUT=300000
```

## 🔑 Required API Keys

### GitHub Token
- **Purpose**: Repository indexing, GitHub API access
- **How to get**: Create a Personal Access Token at https://github.com/settings/tokens
- **Required for**: Repository tools, code search

### OpenRouter API Key
- **Purpose**: AI-powered search and research
- **How to get**: Sign up at https://openrouter.ai/
- **Required for**: Deep research, AI analysis

### Serper API Key
- **Purpose**: Web search functionality
- **How to get**: Sign up at https://serper.dev/
- **Required for**: Web search tools

### SerpAPI Key
- **Purpose**: Alternative web search provider
- **How to get**: Sign up at https://serpapi.com/
- **Required for**: Web search tools (alternative to Serper)

## 🛠️ How to Use in Your Tools

The environment manager is automatically available in all tool contexts. Here's how to use it:

```typescript
export function registerMyTools({ mcp, envManager }: McpToolContext): void {
  mcp.tool(
    'my_tool',
    'My tool description',
    {
      // your schema
    },
    async (params) => {
      // Get tokens
      const githubToken = envManager.getToken('github')
      const openrouterToken = envManager.getToken('openrouter')
      
      // Check if tokens are available
      if (!envManager.hasToken('github')) {
        return {
          content: [{
            type: 'text',
            text: '⚠️ GitHub token not configured'
          }]
        }
      }
      
      // Get URLs
      const qdrantUrl = envManager.getUrl('qdrant')
      const redisUrl = envManager.getUrl('redis')
      
      // Get rate limits
      const githubRateLimit = envManager.getRateLimit('github')
      
      // Your tool logic here
    }
  )
}
```

## 🔍 Available Environment Manager Methods

### Token Management
- `envManager.getToken(service)` - Get API token for a service
- `envManager.hasToken(service)` - Check if token is available
- `envManager.validateRequiredTokens(services)` - Validate multiple tokens

### URL Management
- `envManager.getUrl(service)` - Get URL for a service
- `envManager.getRateLimit(service)` - Get rate limit for a service

### Configuration
- `envManager.getIndexingConfig()` - Get indexing settings
- `envManager.getLoadedFiles()` - Get list of loaded .env files

## 🚀 Supported Services

| Service | Token Method | URL Method | Rate Limit Method |
|---------|-------------|------------|-------------------|
| GitHub | `getToken('github')` | - | `getRateLimit('github')` |
| OpenRouter | `getToken('openrouter')` | - | `getRateLimit('openrouter')` |
| Qdrant | `getToken('qdrant')` | `getUrl('qdrant')` | - |
| Redis | - | `getUrl('redis')` | - |
| Database | - | `getUrl('database')` | - |
| Serper | `getToken('serper')` | - | - |
| SerpAPI | `getToken('serpapi')` | - | - |

## 🔒 Security Notes

1. **Never commit your `.env` file** - Add it to `.gitignore`
2. **Use environment-specific files** - `.env.local`, `.env.development`, `.env.production`
3. **Rotate tokens regularly** - Especially for production environments
4. **Use least privilege** - Only grant necessary permissions to API tokens

## 🐛 Troubleshooting

### Token Not Found
```bash
# Check if .env file exists
ls -la .env

# Check if variables are loaded
echo $GITHUB_TOKEN
```

### Multiple .env Files
The system loads files in this order:
1. `.env`
2. `.env.local`
3. `.env.development`
4. `.env.production`

Later files override earlier ones.

### Debug Environment Loading
```bash
# Run with debug logging
zod-mcp --debug
```

## 📝 Example Usage

Here's a complete example of a tool using environment variables:

```typescript
export function registerGitHubTools({ mcp, envManager }: McpToolContext): void {
  mcp.tool(
    'github_search',
    'Search GitHub repositories with authentication',
    {
      query: z.string().describe('Search query'),
      limit: z.number().default(10).describe('Number of results')
    },
    async ({ query, limit }) => {
      const token = envManager.getToken('github')
      
      if (!token) {
        return {
          content: [{
            type: 'text',
            text: '❌ GitHub token not configured. Add GITHUB_TOKEN to your .env file.'
          }]
        }
      }
      
      // Use the token for GitHub API calls
      const octokit = new Octokit({ auth: token })
      const results = await octokit.search.repos({ q: query, per_page: limit })
      
      return {
        content: [{
          type: 'text',
          text: `Found ${results.data.items.length} repositories for "${query}"`
        }]
      }
    }
  )
}
```

## 🎯 Quick Start

1. Copy the environment variables above
2. Create a `.env` file in your project root
3. Add your API keys
4. Restart your MCP server
5. Your tools will now have access to the tokens!

Happy coding! 🚀 
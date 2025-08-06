#!/bin/bash

echo "🚀 Setting up ZOD MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your API keys"
fi

# Make CLI executable
chmod +x bin/cli.mjs

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📋 Available commands:"
echo "  • npm run dev-stdio    - Run with stdio transport"
echo "  • npm run dev-http     - Run with HTTP transport"
echo "  • node bin/cli.mjs --help  - Show all options"
echo ""
echo "🔧 Next steps:"
echo "  1. Edit .env file with your API keys (optional)"
echo "  2. Restart Cursor IDE to load MCP configuration"
echo "  3. Test with: list_repositories() or zod_web_search('test')"
echo ""
echo "📖 Documentation: README.md and CURSOR_SETUP.md" 
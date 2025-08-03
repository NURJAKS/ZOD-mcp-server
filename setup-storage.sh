#!/bin/bash

# NIA MCP Server Storage Setup Script
# This script helps set up all storage services for the NIA MCP Server

set -e

echo "🚀 NIA MCP Server Storage Setup"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use. Please stop the service using this port."
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking port availability..."
check_port 6379 || exit 1  # Redis
check_port 7474 || exit 1  # Neo4j HTTP
check_port 7687 || exit 1  # Neo4j Bolt
check_port 9000 || exit 1  # MinIO API
check_port 9001 || exit 1  # MinIO Console
check_port 6333 || exit 1  # Qdrant

echo "✅ All ports are available"

# Start storage services
echo "🐳 Starting storage services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "🔍 Checking service status..."

# Check Redis
if curl -s http://localhost:6379 > /dev/null 2>&1; then
    echo "✅ Redis is running on port 6379"
else
    echo "❌ Redis is not responding"
fi

# Check Neo4j
if curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo "✅ Neo4j HTTP is running on port 7474"
    echo "   Console: http://localhost:7474 (neo4j/password123)"
else
    echo "❌ Neo4j HTTP is not responding"
fi

# Check MinIO
if curl -s http://localhost:9000 > /dev/null 2>&1; then
    echo "✅ MinIO API is running on port 9000"
    echo "   Console: http://localhost:9001 (minioadmin/minioadmin123)"
else
    echo "❌ MinIO API is not responding"
fi

# Check Qdrant
if curl -s http://localhost:6333/collections > /dev/null 2>&1; then
    echo "✅ Qdrant is running on port 6333"
else
    echo "❌ Qdrant is not responding"
fi

# Create .env file with storage configuration
echo "📝 Creating .env file with storage configuration..."
cat > .env << EOF
# GitHub API Configuration
GITHUB_TOKEN=your_github_token_here

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Neo4j Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password123

# MinIO Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_BUCKET=nia-documents

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
EOF

echo "✅ Storage setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run 'npm run build' to build the project"
echo "3. Run 'npm run dev' to start the MCP server"
echo ""
echo "🌐 Service URLs:"
echo "• Neo4j Console: http://localhost:7474 (neo4j/password123)"
echo "• MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)"
echo "• Qdrant API: http://localhost:6333"
echo ""
echo "🛠️  Useful commands:"
echo "• docker-compose up -d    # Start all services"
echo "• docker-compose down     # Stop all services"
echo "• docker-compose logs     # View service logs"
echo "• docker-compose restart  # Restart all services" 
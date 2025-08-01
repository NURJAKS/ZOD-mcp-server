#!/bin/bash

# Скрипт для настройки MCP в новой вкладке Cursor

echo "🚀 Настройка MCP для новой вкладки Cursor..."

# Создаем папку .cursor если её нет
mkdir -p .cursor

# Создаем MCP конфигурацию
cat > .cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "nia-mcp-server": {
      "command": "node",
      "args": [
        "/home/nurbekk/mcp-starter/dist/index.mjs",
        "stdio"
      ]
    }
  }
}
EOF

echo "✅ MCP конфигурация создана в .cursor/mcp.json"
echo ""
echo "📋 Что делать дальше:"
echo "1. Откройте эту папку в Cursor"
echo "2. Перезапустите Cursor (если нужно)"
echo "3. Попробуйте команду: index_repository(repo_url: \"https://github.com/NURJAKS/Todo-list\")"
echo ""
echo "🎯 Готово! Ваш MCP сервер подключен." 
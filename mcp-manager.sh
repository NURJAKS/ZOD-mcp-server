#!/bin/bash

# MCP Server Manager
# Управление запущенными MCP серверами

case "$1" in
    "status")
        echo "🔍 MCP Server Status:"
        echo "======================"
        
        # Node.js MCP процессы
        echo "Node.js MCP Servers:"
        ps aux | grep "node.*cli.mjs" | grep -v grep | while read line; do
            echo "  $line"
        done
        
        # Cursor MCP процессы
        echo -e "\nCursor MCP Servers:"
        ps aux | grep "Cursor.*cli.mjs" | grep -v grep | while read line; do
            echo "  $line"
        done
        
        # Проверка портов
        echo -e "\nPort Status:"
        for port in 3000 3001 4200 4201; do
            if lsof -i :$port >/dev/null 2>&1; then
                echo "  Port $port: ACTIVE"
            else
                echo "  Port $port: INACTIVE"
            fi
        done
        ;;
        
    "stop")
        echo "🛑 Stopping MCP servers..."
        
        # Остановка Node.js процессов
        pids=$(ps aux | grep "node.*cli.mjs" | grep -v grep | awk '{print $2}')
        if [ ! -z "$pids" ]; then
            echo "Stopping Node.js MCP servers: $pids"
            echo $pids | xargs kill
        fi
        
        # Остановка Cursor процессов (только MCP)
        pids=$(ps aux | grep "Cursor.*cli.mjs" | grep -v grep | awk '{print $2}')
        if [ ! -z "$pids" ]; then
            echo "Stopping Cursor MCP servers: $pids"
            echo $pids | xargs kill
        fi
        
        echo "✅ MCP servers stopped"
        ;;
        
    "kill")
        echo "💀 Force killing MCP servers..."
        
        # Принудительная остановка
        pids=$(ps aux | grep "bin/cli.mjs" | grep -v grep | awk '{print $2}')
        if [ ! -z "$pids" ]; then
            echo "Force killing MCP servers: $pids"
            echo $pids | xargs kill -9
        fi
        
        echo "✅ MCP servers force killed"
        ;;
        
    "restart")
        echo "🔄 Restarting MCP servers..."
        $0 stop
        sleep 2
        echo "Starting new MCP server..."
        node bin/cli.mjs --stdio &
        echo "✅ MCP server restarted"
        ;;
        
    "start")
        echo "🚀 Starting MCP server..."
        node bin/cli.mjs --stdio &
        echo "✅ MCP server started"
        ;;
        
    *)
        echo "MCP Server Manager"
        echo "=================="
        echo "Usage: $0 {status|start|stop|kill|restart}"
        echo ""
        echo "Commands:"
        echo "  status   - Show running MCP servers"
        echo "  start    - Start new MCP server"
        echo "  stop     - Stop all MCP servers gracefully"
        echo "  kill     - Force kill all MCP servers"
        echo "  restart  - Restart all MCP servers"
        ;;
esac 
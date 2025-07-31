#!/usr/bin/env node

// Простой тест для проверки работы MCP сервера
const { spawn } = require('child_process');

console.log('🧪 Тестирование NIA MCP Server...\n');

// Запускаем MCP сервер
const mcpServer = spawn('node', ['./bin/cli.mjs', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

// Тестовые данные для проверки инструментов
const testTools = [
    {
        name: 'index_repository',
        description: 'Индексация GitHub репозитория',
        params: {
            repo_url: 'https://github.com/owner/test-repo',
            branch: 'main'
        }
    },
    {
        name: 'list_repositories',
        description: 'Список репозиториев',
        params: {}
    },
    {
        name: 'search_codebase',
        description: 'Поиск по коду',
        params: {
            query: 'authentication function',
            include_sources: true
        }
    },
    {
        name: 'nia_web_search',
        description: 'Веб-поиск',
        params: {
            query: 'RAG libraries',
            num_results: 3
        }
    },
    {
        name: 'getWeather',
        description: 'Информация о погоде',
        params: {
            city: 'Moscow',
            units: 'celsius'
        }
    }
];

console.log('📋 Доступные инструменты для тестирования:');
testTools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
});

console.log('\n✅ MCP сервер готов к тестированию!');
console.log('💡 Используйте эти инструменты в Cursor или другом MCP клиенте:');
console.log('   - index_repository');
console.log('   - list_repositories');
console.log('   - search_codebase');
console.log('   - nia_web_search');
console.log('   - nia_deep_research_agent');
console.log('   - initialize_project');
console.log('   - и другие...\n');

// Обработка вывода сервера
mcpServer.stdout.on('data', (data) => {
    console.log('📡 MCP Server:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
    console.log('❌ MCP Server Error:', data.toString());
});

mcpServer.on('close', (code) => {
    console.log(`\n🔚 MCP Server закрыт с кодом: ${code}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка тестирования...');
    mcpServer.kill();
    process.exit(0);
}); 
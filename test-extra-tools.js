#!/usr/bin/env node

console.log('🧪 Тестирование 3 дополнительных инструментов NIA MCP Server\n');

// Тестовые данные для 3 дополнительных инструментов
const extraTools = [
    {
        name: 'doSomething',
        description: 'Базовый тестовый инструмент',
        params: {
            param1: 'test1',
            param2: 'test2'
        },
        expectedResult: 'Hello test1 and test2'
    },
    {
        name: 'getWeather',
        description: 'Информация о погоде',
        params: {
            city: 'Moscow',
            units: 'celsius'
        },
        expectedResult: 'Weather in Moscow: 22°C, Sunny, Humidity: 65%'
    },
    {
        name: 'translateText',
        description: 'Перевод текста',
        params: {
            text: 'Hello world',
            targetLanguage: 'es'
        },
        expectedResult: '[ES] Hello world (translated)'
    }
];

console.log('📋 3 дополнительных инструмента для тестирования:\n');

extraTools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}`);
    console.log(`   Описание: ${tool.description}`);
    console.log(`   Параметры: ${JSON.stringify(tool.params, null, 2)}`);
    console.log(`   Ожидаемый результат: ${tool.expectedResult}`);
    console.log('');
});

console.log('🔧 Как протестировать в Cursor:\n');

console.log('1. Запустите MCP сервер:');
console.log('   npm run dev-stdio\n');

console.log('2. В Cursor используйте команды:');
console.log('   - doSomething(param1: "test1", param2: "test2")');
console.log('   - getWeather(city: "Moscow", units: "celsius")');
console.log('   - translateText(text: "Hello world", targetLanguage: "es")\n');

console.log('3. Или протестируйте через MCP Inspector:');
console.log('   npm run inspect\n');

console.log('✅ Все 3 дополнительных инструмента готовы к тестированию!');
console.log('💡 Эти инструменты демонстрируют базовую функциональность MCP сервера.'); 
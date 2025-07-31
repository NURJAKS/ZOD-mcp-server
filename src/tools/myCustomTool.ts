import type { McpToolContext } from '../types'
import { z } from 'zod'

export function registerMyCustomTool({ mcp }: McpToolContext): void {
    // Инструмент для получения информации о погоде
    mcp.tool(
        'getWeather',
        'Get weather information for a specific city',
        {
            city: z.string().describe('The name of the city to get weather for'),
            units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units (celsius or fahrenheit)'),
        },
        async ({ city, units = 'celsius' }) => {
            // Здесь можно добавить реальный API вызов к погодному сервису
            const mockWeather = {
                city,
                temperature: units === 'celsius' ? '22°C' : '72°F',
                condition: 'Sunny',
                humidity: '65%',
            }

            return {
                content: [{
                    type: 'text',
                    text: `Weather in ${city}: ${mockWeather.temperature}, ${mockWeather.condition}, Humidity: ${mockWeather.humidity}`
                }],
            }
        },
    )

    // Инструмент для перевода текста
    mcp.tool(
        'translateText',
        'Translate text to different language',
        {
            text: z.string().describe('Text to translate'),
            targetLanguage: z.string().describe('Target language code (e.g., "es", "fr", "de")'),
        },
        async ({ text, targetLanguage }) => {
            // Здесь можно добавить реальный API вызов к переводчику
            const mockTranslation = `[${targetLanguage.toUpperCase()}] ${text} (translated)`

            return {
                content: [{
                    type: 'text',
                    text: mockTranslation
                }],
            }
        },
    )
} 
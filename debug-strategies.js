import { FixStrategyManager } from './dist/tools/zod-core/fix-strategies.js'

const manager = new FixStrategyManager()

// Test strategy retrieval
console.log('Testing strategy retrieval...')
const consoleStrategy = manager.getStrategy('no-console', 'javascript')
console.log('Console strategy:', consoleStrategy ? 'Found' : 'Not found')

const eqeqeqStrategy = manager.getStrategy('eqeqeq', 'javascript')
console.log('Eqeqeq strategy:', eqeqeqStrategy ? 'Found' : 'Not found')

const anyStrategy = manager.getStrategy('no-any', 'typescript')
console.log('Any strategy:', anyStrategy ? 'Found' : 'Not found')

// Test language detection
console.log('\nTesting language detection...')
console.log('test.js ->', manager.detectLanguage('test.js'))
console.log('test.ts ->', manager.detectLanguage('test.ts'))
console.log('test.py ->', manager.detectLanguage('test.py'))
console.log('test.go ->', manager.detectLanguage('test.go')) 
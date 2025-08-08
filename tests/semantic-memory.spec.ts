import { describe, it, expect } from 'vitest'
import { SemanticMemory } from '../src/tools/zod-core/semantic-memory'

describe('SemanticMemory', () => {
  it('indexes project with chunking metadata without throwing', async () => {
    const sm = new SemanticMemory()
    await sm.ensureIndexedProject(process.cwd(), 'local')
    const hits = await sm.searchProject('package')
    expect(Array.isArray(hits)).toBe(true)
  })
})


#!/usr/bin/env node
import { defineCommand, runMain as _runMain } from 'citty'
import { handle } from './core'

const cli = defineCommand({
  meta: { name: 'mcp-zod-core', version: '0.1.0', description: 'ZOD Core CLI' },
  args: {
    query: { type: 'string', required: true, description: 'User query' },
    context: { type: 'string', description: 'Project path' },
    intent: { type: 'string', description: 'analyze|explain|suggest|plan|reflect' },
    session: { type: 'string', description: 'Session id', default: 'cli-session' },
  },
  async run({ args }) {
    const res = await handle(
      { query: String(args.query), intent: args.intent as any },
      { sessionId: String(args.session), projectPath: args.context ? String(args.context) : process.cwd() },
    )
    console.log(JSON.stringify(res, null, 2))
  },
})

export const runMain = () => _runMain(cli)

if (import.meta.url === `file://${process.argv[1]}`) runMain()


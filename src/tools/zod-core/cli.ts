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
    preferInternalAnalysis: { type: 'boolean', description: 'Prefer internal analysis over external tools' },
    allowVisualizer: { type: 'boolean', description: 'Allow visualizer tool' },
    allowExternalSearch: { type: 'boolean', description: 'Allow external web/deep research' },
    allowInit: { type: 'boolean', description: 'Allow project initializer' },
  },
  async run({ args }) {
    const res = await handle(
      { query: String(args.query), intent: args.intent as any },
      { sessionId: String(args.session), projectPath: args.context ? String(args.context) : process.cwd(), toolPreferences: {
        preferInternalAnalysis: args.preferInternalAnalysis as any,
        allowVisualizer: args.allowVisualizer as any,
        allowExternalSearch: args.allowExternalSearch as any,
        allowInit: args.allowInit as any,
      } },
    )
    console.log(JSON.stringify(res, null, 2))
  },
})

export const runMain = () => _runMain(cli)

if (import.meta.url === `file://${process.argv[1]}`) runMain()


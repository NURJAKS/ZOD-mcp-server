#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { join } from 'node:path'

async function detectPython() {
  if (process.env.FOCUSFLOW_PYTHON) return process.env.FOCUSFLOW_PYTHON
  const candidates = ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const child = spawn(cmd, ['--version'])
      await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', () => resolve())
      })
      return cmd
    } catch {}
  }
  return null
}

;(async () => {
  const pythonCmd = await detectPython()
  if (!pythonCmd) {
    console.error('❌ Python not found. Install python3 or set FOCUSFLOW_PYTHON')
    process.exit(1)
  }
  const appPath = join(process.cwd(), 'bin', 'focusflow_tray.py')
  const child = spawn(pythonCmd, [appPath], { stdio: 'inherit', env: { ...process.env } })
  child.on('exit', (code) => process.exit(code ?? 0))
})()


import type { McpToolContext } from '../types'
import { z } from 'zod'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let focusFlowProc: ChildProcessWithoutNullStreams | null = null
let focusFlowPort = 8590
let lastKnownUrl: string | null = null

const CONFIG_DIR = join(homedir(), '.focusflow')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

interface FocusFlowConfig {
  work_minutes: number
  break_minutes: number
  theme: 'dark' | 'light'
}

function readConfig(): FocusFlowConfig {
  try {
    if (!existsSync(CONFIG_DIR))
      mkdirSync(CONFIG_DIR, { recursive: true })
    if (!existsSync(CONFIG_PATH)) {
      const defaultCfg: FocusFlowConfig = { work_minutes: 25, break_minutes: 5, theme: 'dark' }
      writeFileSync(CONFIG_PATH, JSON.stringify(defaultCfg, null, 2))
      return defaultCfg
    }
    const raw = readFileSync(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      work_minutes: Number(parsed.work_minutes) || 25,
      break_minutes: Number(parsed.break_minutes) || 5,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    }
  } catch {
    return { work_minutes: 25, break_minutes: 5, theme: 'dark' }
  }
}

function writeConfig(config: Partial<FocusFlowConfig>) {
  const current = readConfig()
  const next = { ...current, ...config }
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2))
}

async function detectPython(): Promise<string | null> {
  const candidates = ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const child = spawn(cmd, ['--version'])
      await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', () => resolve(null))
      })
      return cmd
    } catch {
      // continue
    }
  }
  return null
}

async function checkStreamlitAvailable(pythonCmd: string): Promise<boolean> {
  try {
    const child = spawn(pythonCmd, ['-c', 'import streamlit'])
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => (code === 0 ? resolve(null) : reject(new Error('missing'))))
    })
    return true
  } catch {
    return false
  }
}

function openBrowser(url: string) {
  const platform = process.platform
  let cmd: string
  let args: string[]
  if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // ignore
  }
}

function isAlive(proc: ChildProcessWithoutNullStreams | null): boolean {
  return !!proc && !proc.killed
}

export function registerFocusFlowTools({ mcp }: McpToolContext): void {
  mcp.tool(
    'focusflow',
    'FocusFlow — минималистичный Pomodoro-инструмент. Действия: start, stop, status, set_config',
    {
      action: z.enum(['start', 'stop', 'status', 'set_config']).describe('Действие'),
      work_minutes: z.number().int().positive().optional().describe('Длительность фокусировки в минутах'),
      break_minutes: z.number().int().positive().optional().describe('Длительность отдыха в минутах'),
      theme: z.enum(['dark', 'light']).optional().describe('Тема интерфейса'),
      port: z.number().int().optional().describe('Порт веб-интерфейса (по умолчанию 8590)'),
      open: z.boolean().optional().default(true).describe('Открыть браузер автоматически'),
    },
    async ({ action, work_minutes, break_minutes, theme, port, open }) => {
      const cfg = readConfig()

      if (action === 'set_config') {
        writeConfig({
          work_minutes: work_minutes ?? cfg.work_minutes,
          break_minutes: break_minutes ?? cfg.break_minutes,
          theme: theme ?? cfg.theme,
        })
        return {
          content: [{
            type: 'text' as const,
            text: `✅ Настройки сохранены: work=${work_minutes ?? cfg.work_minutes}m, break=${break_minutes ?? cfg.break_minutes}m, theme=${theme ?? cfg.theme}`,
          }],
        }
      }

      if (action === 'status') {
        const running = isAlive(focusFlowProc)
        const url = lastKnownUrl || `http://localhost:${focusFlowPort}`
        return {
          content: [{
            type: 'text' as const,
            text: running ? `✅ FocusFlow запущен: ${url}` : '⏹️ FocusFlow не запущен',
          }],
        }
      }

      if (action === 'stop') {
        if (focusFlowProc && isAlive(focusFlowProc)) {
          focusFlowProc.kill()
          focusFlowProc = null
        }
        return { content: [{ type: 'text' as const, text: '⏹️ FocusFlow остановлен' }] }
      }

      // start
      focusFlowPort = port || focusFlowPort || 8590
      writeConfig({
        work_minutes: work_minutes ?? cfg.work_minutes,
        break_minutes: break_minutes ?? cfg.break_minutes,
        theme: theme ?? cfg.theme,
      })

      if (focusFlowProc && isAlive(focusFlowProc)) {
        const url = lastKnownUrl || `http://localhost:${focusFlowPort}`
        return { content: [{ type: 'text' as const, text: `🔄 Уже запущен: ${url}` }] }
      }

      const pythonCmd = await detectPython()
      if (!pythonCmd) {
        return { content: [{ type: 'text' as const, text: '❌ Python не найден. Установите python3.' }] }
      }
      const hasStreamlit = await checkStreamlitAvailable(pythonCmd)
      if (!hasStreamlit) {
        return { content: [{ type: 'text' as const, text: '❌ Streamlit не установлен. Установите: pip install streamlit' }] }
      }

      const appPath = join(process.cwd(), 'bin', 'focusflow_app.py')
      const chosenPort = focusFlowPort
      const args = ['-m', 'streamlit', 'run', appPath, '--server.port', String(chosenPort), '--server.headless', 'true']
      const env = { ...process.env }
      env.FOCUSFLOW_PORT = String(chosenPort)

      focusFlowProc = spawn(pythonCmd, args, { env })
      lastKnownUrl = `http://localhost:${chosenPort}`

      // Warm-up delay and optional auto-open
      setTimeout(() => {
        if (open !== false) openBrowser(lastKnownUrl!)
      }, 1200)

      focusFlowProc.stdout.on('data', () => {})
      focusFlowProc.stderr.on('data', () => {})
      focusFlowProc.on('exit', () => {
        focusFlowProc = null
      })

      return {
        content: [{ type: 'text' as const, text: `🚀 FocusFlow запущен на ${lastKnownUrl}` }],
      }
    },
  )
}


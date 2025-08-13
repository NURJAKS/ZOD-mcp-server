export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, any>
  error?: Error
}

export class LoggingService {
  private isStdioMode = process.argv.includes('--stdio')

  log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (this.isStdioMode) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error
    }

    this.outputLog(entry)
  }

  private outputLog(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? `\n${entry.error.stack}` : ''

    const logMessage = `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage)
        break
      case LogLevel.INFO:
        console.info(logMessage)
        break
      case LogLevel.WARN:
        console.warn(logMessage)
        break
      case LogLevel.ERROR:
        console.error(logMessage)
        break
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error)
  }
}

export const logger = new LoggingService()

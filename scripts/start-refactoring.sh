#!/bin/bash

# 🚀 MCP Server Refactoring Setup Script
# This script sets up the new directory structure for Phase 1 refactoring

set -e

echo "🚀 Starting MCP Server Refactoring Setup..."

# Create new directory structure
echo "📁 Creating new directory structure..."

mkdir -p src/domains/indexing/{entities,repositories,services,value-objects}
mkdir -p src/domains/search/{entities,repositories,services,value-objects}
mkdir -p src/domains/analysis/{entities,repositories,services,value-objects}
mkdir -p src/domains/visualization/{entities,repositories,services,value-objects}

mkdir -p src/shared/{infrastructure,interfaces,utils,types}
mkdir -p src/application/{use-cases,commands,queries}
mkdir -p src/presentation/{controllers,middlewares,validators}

# Create test directory structure
mkdir -p tests/unit/domains/{indexing,search,analysis,visualization}
mkdir -p tests/integration/{api,database,search}
mkdir -p tests/e2e
mkdir -p tests/fixtures

echo "✅ Directory structure created"

# Create base interface files
echo "📝 Creating base interface files..."

cat > src/shared/interfaces/base.ts << 'EOF'
export interface Entity<T> {
  id: string
  createdAt: Date
  updatedAt: Date
  toJSON(): T
}

export interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
  delete(id: string): Promise<boolean>
  update(id: string, updates: Partial<T>): Promise<T>
}

export interface Service<T, R> {
  execute(input: T): Promise<R>
}
EOF

# Create service container
cat > src/shared/infrastructure/service-container.ts << 'EOF'
export class ServiceContainer {
  private services = new Map<string, any>()

  register<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  get<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }
    return service
  }

  has(name: string): boolean {
    return this.services.has(name)
  }
}

export const container = new ServiceContainer()
EOF

# Create error handling infrastructure
cat > src/shared/infrastructure/error-handling/error-types.ts << 'EOF'
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.VALIDATION_ERROR, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.NOT_FOUND_ERROR, 'NOT_FOUND_ERROR')
    this.name = 'NotFoundError'
  }
}
EOF

# Create logging service
cat > src/shared/infrastructure/logging/logging.service.ts << 'EOF'
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
EOF

# Create type definitions
cat > src/shared/types/api.ts << 'EOF'
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: Date
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface SearchFilters {
  repositories?: string[]
  sources?: string[]
  languages?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
}

export interface SearchOptions {
  maxResults?: number
  minScore?: number
  includeSources?: boolean
}
EOF

echo "✅ Base files created"

# Create initial entity files
echo "📝 Creating initial entity files..."

cat > src/domains/indexing/entities/repository.entity.ts << 'EOF'
import { Entity } from '../../../shared/interfaces/base'

export interface RepositoryData {
  id: string
  owner: string
  repo: string
  branch: string
  status: 'indexing' | 'completed' | 'failed'
  progress: number
  indexedFiles: number
  totalFiles: number
  lastIndexed: Date
  error?: string
  displayName?: string
}

export class RepositoryEntity implements Entity<RepositoryData> {
  constructor(
    public readonly id: string,
    public owner: string,
    public repo: string,
    public branch: string,
    public status: 'indexing' | 'completed' | 'failed',
    public progress: number,
    public indexedFiles: number,
    public totalFiles: number,
    public lastIndexed: Date,
    public error?: string,
    public displayName?: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  toJSON(): RepositoryData {
    return {
      id: this.id,
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      status: this.status,
      progress: this.progress,
      indexedFiles: this.indexedFiles,
      totalFiles: this.totalFiles,
      lastIndexed: this.lastIndexed,
      error: this.error,
      displayName: this.displayName
    }
  }

  updateProgress(progress: number, indexedFiles: number, totalFiles: number): void {
    this.progress = progress
    this.indexedFiles = indexedFiles
    this.totalFiles = totalFiles
    this.updatedAt = new Date()
  }

  markAsCompleted(): void {
    this.status = 'completed'
    this.progress = 100
    this.updatedAt = new Date()
  }

  markAsFailed(error: string): void {
    this.status = 'failed'
    this.error = error
    this.updatedAt = new Date()
  }
}
EOF

echo "✅ Initial entity files created"

# Create README for the new structure
cat > REFACTORING_README.md << 'EOF'
# 🚀 MCP Server Refactoring - Phase 1

## 📁 New Directory Structure

The refactoring introduces a Domain-Driven Design (DDD) architecture:

```
src/
├── domains/                    # Business domains
│   ├── indexing/              # Repository indexing domain
│   ├── search/                # Search functionality domain
│   ├── analysis/              # Code analysis domain
│   └── visualization/         # Visualization domain
├── shared/                    # Shared infrastructure
│   ├── infrastructure/        # Technical infrastructure
│   ├── interfaces/            # Base interfaces
│   ├── types/                 # Type definitions
│   └── utils/                 # Utility functions
├── application/               # Application layer
│   ├── use-cases/            # Business use cases
│   ├── commands/             # Command handlers
│   └── queries/              # Query handlers
└── presentation/              # Presentation layer
    ├── controllers/           # API controllers
    ├── middlewares/           # Middleware
    └── validators/            # Input validation
```

## 🎯 Next Steps

1. **Review the new structure** - Understand the DDD approach
2. **Start with Indexing Domain** - Begin migrating `indexer.ts`
3. **Follow the implementation guide** - Use `PHASE_1_IMPLEMENTATION.md`
4. **Test incrementally** - Ensure functionality is preserved
5. **Document changes** - Update documentation as you go

## 📋 Migration Checklist

- [ ] Review new directory structure
- [ ] Understand DDD principles
- [ ] Start with indexing domain
- [ ] Create entity classes
- [ ] Implement service classes
- [ ] Add repository interfaces
- [ ] Update dependency injection
- [ ] Test thoroughly
- [ ] Remove old code

## 🚀 Getting Started

1. Run this setup script: `./scripts/start-refactoring.sh`
2. Review the generated files
3. Follow the implementation guide
4. Start with the indexing domain
5. Test each step thoroughly

## 📚 Resources

- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Complete refactoring plan
- [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Detailed implementation guide
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) - DDD principles
EOF

echo "✅ Refactoring README created"

# Make the script executable
chmod +x scripts/start-refactoring.sh

echo ""
echo "🎉 Refactoring setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Review the new directory structure"
echo "2. Read REFACTORING_README.md"
echo "3. Follow PHASE_1_IMPLEMENTATION.md"
echo "4. Start with the indexing domain"
echo "5. Test incrementally"
echo ""
echo "🚀 Happy refactoring!" 
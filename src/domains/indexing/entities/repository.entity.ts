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

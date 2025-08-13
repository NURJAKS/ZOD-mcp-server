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

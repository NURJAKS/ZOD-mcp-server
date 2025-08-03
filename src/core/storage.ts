import { Client } from 'minio'
import { safeLog } from '../utils'

export interface StorageObject {
  name: string
  size: number
  lastModified: Date
  etag: string
  metadata?: Record<string, string>
}

export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export class StorageService {
  private client: Client | null = null
  private bucket: string = 'nia-documents'
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
      const port = parseInt(process.env.MINIO_PORT || '9000')
      const accessKey = process.env.MINIO_ACCESS_KEY
      const secretKey = process.env.MINIO_SECRET_KEY
      const useSSL = process.env.MINIO_USE_SSL === 'true'
      this.bucket = process.env.MINIO_BUCKET || 'nia-documents'

      if (!accessKey || !secretKey) {
        safeLog('⚠️ MinIO credentials not configured, storage features disabled', 'warn')
        return
      }

      this.client = new Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey,
      })

      // Test connection and create bucket if needed
      await this.ensureBucketExists()
      
      this.isInitialized = true
      safeLog('✅ MinIO object storage connected')
    } catch (error) {
      safeLog(`⚠️ MinIO connection failed: ${error}`, 'warn')
      this.client = null
    }
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.client) return

    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket)
        safeLog(`✅ Created bucket: ${this.bucket}`)
      }
    } catch (error) {
      safeLog(`Failed to ensure bucket exists: ${error}`, 'error')
    }
  }

  public get isReady(): boolean {
    return this.isInitialized && this.client !== null
  }

  async uploadFile(
    objectName: string,
    data: Buffer | string,
    options: UploadOptions = {}
  ): Promise<void> {
    if (!this.client) {
      safeLog('MinIO not available, skipping file upload', 'warn')
      return
    }

    try {
      const buffer = typeof data === 'string' ? Buffer.from(data) : data
      
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': options.contentType || 'application/octet-stream',
          ...options.metadata,
        }
      )
    } catch (error) {
      safeLog(`Storage upload error: ${error}`, 'error')
      throw error
    }
  }

  async downloadFile(objectName: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('MinIO not available')
    }

    try {
      const stream = await this.client.getObject(this.bucket, objectName)
      const chunks: Buffer[] = []
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    } catch (error) {
      safeLog(`Storage download error: ${error}`, 'error')
      throw error
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    if (!this.client) return

    try {
      await this.client.removeObject(this.bucket, objectName)
    } catch (error) {
      safeLog(`Storage delete error: ${error}`, 'error')
    }
  }

  async listFiles(prefix?: string): Promise<StorageObject[]> {
    if (!this.client) return []

    try {
      const stream = this.client.listObjects(this.bucket, prefix, true)
      const objects: StorageObject[] = []

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          objects.push({
            name: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
            metadata: obj.metadata,
          })
        })
        stream.on('end', () => resolve(objects))
        stream.on('error', reject)
      })
    } catch (error) {
      safeLog(`Storage list error: ${error}`, 'error')
      return []
    }
  }

  async getFileInfo(objectName: string): Promise<StorageObject | null> {
    if (!this.client) return null

    try {
      const stat = await this.client.statObject(this.bucket, objectName)
      return {
        name: objectName,
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        metadata: stat.metaData,
      }
    } catch (error) {
      safeLog(`Storage stat error: ${error}`, 'error')
      return null
    }
  }

  async getFileUrl(objectName: string, expiresInHours: number = 24): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO not available')
    }

    try {
      return await this.client.presignedGetObject(this.bucket, objectName, expiresInHours * 3600)
    } catch (error) {
      safeLog(`Storage URL generation error: ${error}`, 'error')
      throw error
    }
  }

  async getStats(): Promise<{
    files: number
    totalSize: number
    bucket: string
    connected: boolean
  }> {
    if (!this.isReady) {
      return { files: 0, totalSize: 0, bucket: this.bucket, connected: false }
    }

    try {
      const files = await this.listFiles()
      const totalSize = files.reduce((sum, file) => sum + file.size, 0)

      return {
        files: files.length,
        totalSize,
        bucket: this.bucket,
        connected: true,
      }
    } catch (error) {
      safeLog(`Storage stats error: ${error}`, 'error')
      return { files: 0, totalSize: 0, bucket: this.bucket, connected: false }
    }
  }

  async close(): Promise<void> {
    // MinIO client doesn't need explicit closing
    this.isInitialized = false
  }
}

// Global storage instance
export const storageService = new StorageService() 
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

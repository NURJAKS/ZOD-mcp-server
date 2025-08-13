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

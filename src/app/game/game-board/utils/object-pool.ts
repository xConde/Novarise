export interface PoolConfig {
  /** Initial pool capacity */
  readonly initialSize: number;
  /** Maximum pool size (limits memory growth) */
  readonly maxSize: number;
}

export class ObjectPool<T> {
  private available: T[] = [];
  private readonly factory: () => T;
  private readonly resetFn: (obj: T) => void;
  private readonly maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    config: PoolConfig
  ) {
    this.factory = factory;
    this.resetFn = reset;
    this.maxSize = config.maxSize;
    // Pre-warm pool
    for (let i = 0; i < config.initialSize; i++) {
      this.available.push(factory());
    }
  }

  /** Acquire an object from the pool, or create new if empty */
  acquire(): T {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    return this.factory();
  }

  /** Return an object to the pool after resetting it */
  release(obj: T): void {
    if (this.available.length < this.maxSize) {
      this.resetFn(obj);
      this.available.push(obj);
    }
    // If pool is full, object is abandoned (GC will collect it)
  }

  /** Current number of available objects in pool */
  get availableCount(): number {
    return this.available.length;
  }

  /** Dispose all pooled objects using provided disposer */
  drain(disposer: (obj: T) => void): void {
    for (const obj of this.available) {
      disposer(obj);
    }
    this.available = [];
  }
}

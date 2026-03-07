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
  private readonly disposeFn?: (obj: T) => void;
  private readonly maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    config: PoolConfig,
    dispose?: (obj: T) => void
  ) {
    this.factory = factory;
    this.resetFn = reset;
    this.disposeFn = dispose;
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

  /** Return an object to the pool after resetting it. If pool is full, disposes the object. */
  release(obj: T): void {
    if (this.available.length < this.maxSize) {
      this.resetFn(obj);
      this.available.push(obj);
    } else if (this.disposeFn) {
      this.disposeFn(obj);
    }
  }

  /** Current number of available objects in pool */
  get availableCount(): number {
    return this.available.length;
  }

  /** Dispose all pooled objects using provided disposer (or constructor disposer) */
  drain(disposer?: (obj: T) => void): void {
    const fn = disposer ?? this.disposeFn;
    if (fn) {
      for (const obj of this.available) {
        fn(obj);
      }
    }
    this.available = [];
  }
}

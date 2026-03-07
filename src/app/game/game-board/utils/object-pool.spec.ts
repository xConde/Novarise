import { ObjectPool, PoolConfig } from './object-pool';

describe('ObjectPool', () => {
  interface TestObj {
    value: number;
    active: boolean;
  }

  const TEST_CONFIG: PoolConfig = { initialSize: 3, maxSize: 5 };

  let factoryCount: number;

  function createFactory(): () => TestObj {
    factoryCount = 0;
    return () => {
      factoryCount++;
      return { value: 0, active: false };
    };
  }

  function resetObj(obj: TestObj): void {
    obj.value = 0;
    obj.active = false;
  }

  it('should pre-warm pool to initialSize', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, TEST_CONFIG);
    expect(pool.availableCount).toBe(TEST_CONFIG.initialSize);
    expect(factoryCount).toBe(TEST_CONFIG.initialSize);
  });

  it('should acquire from pool when available', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, TEST_CONFIG);
    const initialCount = factoryCount;

    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(pool.availableCount).toBe(TEST_CONFIG.initialSize - 1);
    // No new factory call — reused from pool
    expect(factoryCount).toBe(initialCount);
  });

  it('should create new object when pool is empty', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, { initialSize: 0, maxSize: 5 });
    const initialCount = factoryCount;

    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(factoryCount).toBe(initialCount + 1);
  });

  it('should return object to pool on release', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, { initialSize: 0, maxSize: 5 });

    const obj = pool.acquire();
    obj.value = 42;
    obj.active = true;

    pool.release(obj);
    expect(pool.availableCount).toBe(1);
  });

  it('should reset object on release', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, { initialSize: 0, maxSize: 5 });

    const obj = pool.acquire();
    obj.value = 99;
    obj.active = true;

    pool.release(obj);

    const reacquired = pool.acquire();
    expect(reacquired).toBe(obj); // Same reference
    expect(reacquired.value).toBe(0);
    expect(reacquired.active).toBe(false);
  });

  it('should respect maxSize and drop excess objects', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, { initialSize: 0, maxSize: 2 });

    const objects = [pool.acquire(), pool.acquire(), pool.acquire()];

    // Release all 3 — only 2 should be kept
    objects.forEach(obj => pool.release(obj));
    expect(pool.availableCount).toBe(2);
  });

  it('should call disposeFn when releasing to a full pool', () => {
    const factory = createFactory();
    const disposed: TestObj[] = [];
    const pool = new ObjectPool<TestObj>(
      factory, resetObj, { initialSize: 0, maxSize: 1 },
      (obj) => disposed.push(obj)
    );

    const a = pool.acquire();
    const b = pool.acquire();

    pool.release(a); // fills pool (maxSize=1)
    pool.release(b); // pool full — should call disposeFn

    expect(pool.availableCount).toBe(1);
    expect(disposed.length).toBe(1);
    expect(disposed[0]).toBe(b);
  });

  it('should use constructor disposeFn in drain when no explicit disposer given', () => {
    const factory = createFactory();
    const disposed: TestObj[] = [];
    const pool = new ObjectPool<TestObj>(
      factory, resetObj, { initialSize: 2, maxSize: 5 },
      (obj) => disposed.push(obj)
    );

    pool.drain();

    expect(disposed.length).toBe(2);
    expect(pool.availableCount).toBe(0);
  });

  it('should drain pool and call disposer on each object', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, TEST_CONFIG);

    const disposed: TestObj[] = [];
    pool.drain(obj => disposed.push(obj));

    expect(disposed.length).toBe(TEST_CONFIG.initialSize);
    expect(pool.availableCount).toBe(0);
  });

  it('should track availableCount correctly through lifecycle', () => {
    const factory = createFactory();
    const pool = new ObjectPool<TestObj>(factory, resetObj, { initialSize: 2, maxSize: 5 });

    expect(pool.availableCount).toBe(2);

    const a = pool.acquire();
    expect(pool.availableCount).toBe(1);

    const b = pool.acquire();
    expect(pool.availableCount).toBe(0);

    pool.release(a);
    expect(pool.availableCount).toBe(1);

    pool.release(b);
    expect(pool.availableCount).toBe(2);

    pool.drain(() => {});
    expect(pool.availableCount).toBe(0);
  });
});

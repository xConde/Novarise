import { MinHeap } from './min-heap';
import { GridNode } from '../models/enemy.model';

function makeNode(x: number, y: number, f: number): GridNode {
  return { x, y, f, g: 0, h: 0 };
}

describe('MinHeap', () => {
  let heap: MinHeap;

  beforeEach(() => {
    heap = new MinHeap();
  });

  it('should return undefined on extractMin from empty heap', () => {
    expect(heap.extractMin()).toBeUndefined();
  });

  it('should report size 0 for empty heap', () => {
    expect(heap.size).toBe(0);
  });

  it('should insert and extract a single node', () => {
    const node = makeNode(1, 2, 5);
    heap.insert(node);
    expect(heap.size).toBe(1);

    const extracted = heap.extractMin();
    expect(extracted).toBe(node);
    expect(heap.size).toBe(0);
  });

  it('should extract nodes in ascending f-score order', () => {
    heap.insert(makeNode(0, 0, 10));
    heap.insert(makeNode(1, 1, 3));
    heap.insert(makeNode(2, 2, 7));
    heap.insert(makeNode(3, 3, 1));
    heap.insert(makeNode(4, 4, 5));

    const results: number[] = [];
    while (heap.size > 0) {
      results.push(heap.extractMin()!.f);
    }

    expect(results).toEqual([1, 3, 5, 7, 10]);
  });

  it('should handle duplicate f-scores', () => {
    heap.insert(makeNode(0, 0, 5));
    heap.insert(makeNode(1, 1, 5));
    heap.insert(makeNode(2, 2, 5));

    expect(heap.size).toBe(3);

    const a = heap.extractMin()!;
    const b = heap.extractMin()!;
    const c = heap.extractMin()!;

    expect(a.f).toBe(5);
    expect(b.f).toBe(5);
    expect(c.f).toBe(5);
    expect(heap.size).toBe(0);
  });

  it('should handle large heaps (100+ nodes)', () => {
    const fScores: number[] = [];
    for (let i = 0; i < 150; i++) {
      const f = Math.floor(Math.random() * 1000);
      fScores.push(f);
      heap.insert(makeNode(i, 0, f));
    }

    expect(heap.size).toBe(150);

    const extracted: number[] = [];
    while (heap.size > 0) {
      extracted.push(heap.extractMin()!.f);
    }

    // Verify sorted ascending
    for (let i = 1; i < extracted.length; i++) {
      expect(extracted[i]).toBeGreaterThanOrEqual(extracted[i - 1]);
    }

    expect(extracted.length).toBe(150);
  });

  it('should track size accurately through mixed operations', () => {
    expect(heap.size).toBe(0);

    heap.insert(makeNode(0, 0, 10));
    expect(heap.size).toBe(1);

    heap.insert(makeNode(1, 1, 5));
    expect(heap.size).toBe(2);

    heap.extractMin();
    expect(heap.size).toBe(1);

    heap.insert(makeNode(2, 2, 8));
    heap.insert(makeNode(3, 3, 3));
    expect(heap.size).toBe(3);

    heap.extractMin();
    heap.extractMin();
    heap.extractMin();
    expect(heap.size).toBe(0);
  });

  it('should maintain heap property after interleaved insert and extract', () => {
    heap.insert(makeNode(0, 0, 20));
    heap.insert(makeNode(1, 1, 10));

    expect(heap.extractMin()!.f).toBe(10);

    heap.insert(makeNode(2, 2, 5));
    heap.insert(makeNode(3, 3, 15));

    expect(heap.extractMin()!.f).toBe(5);
    expect(heap.extractMin()!.f).toBe(15);
    expect(heap.extractMin()!.f).toBe(20);
  });

  it('should return the same reference that was inserted', () => {
    const node = makeNode(5, 5, 42);
    heap.insert(node);
    expect(heap.extractMin()).toBe(node);
  });
});

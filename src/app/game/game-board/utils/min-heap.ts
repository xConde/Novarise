import { GridNode } from '../models/enemy.model';

/**
 * Binary min-heap for GridNode objects, ordered by f-score (ascending).
 *
 * Used by A* pathfinding to replace the O(n) linear scan for the lowest
 * f-cost node with O(log n) extract-min.
 *
 * Instead of decrease-key, we use a "lazy deletion" pattern:
 * duplicate entries may exist in the heap after re-insertion — callers
 * check a companion Map to detect and skip stale entries.
 */
export class MinHeap {
  private heap: GridNode[] = [];

  get size(): number {
    return this.heap.length;
  }

  insert(node: GridNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  extractMin(): GridNode | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    const min = this.heap[0];

    if (this.heap.length === 1) {
      this.heap.length = 0;
      return min;
    }

    this.heap[0] = this.heap[this.heap.length - 1];
    this.heap.length--;
    this.sinkDown(0);

    return min;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (this.heap[index].f >= this.heap[parentIndex].f) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.heap[left].f < this.heap[smallest].f) {
        smallest = left;
      }

      if (right < length && this.heap[right].f < this.heap[smallest].f) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CardId } from '../../run/models/card.model';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'novarise_seen_cards';

/**
 * Tracks which cards the player has ever encountered — drafted into a hand,
 * offered as a reward, or seen in a shop. Persists to localStorage at
 * profile scope (no checkpoint versioning — not encounter-scoped).
 *
 * Drives the library's Seen / Unseen tabs (L5). Safe to call `markSeen`
 * from hot paths (DeckService.drawOne, RunService reward generation) —
 * the write is a no-op when the id was already seen, so repeated calls
 * don't thrash localStorage.
 *
 * "Seen" here means *offered*, not *kept*. The QA user's goal is "what
 * haven't I encountered yet?" — so seeing a reward card you didn't
 * take still counts.
 */
@Injectable({ providedIn: 'root' })
export class SeenCardsService {
  private readonly ids = new Set<CardId>();
  private readonly subject = new BehaviorSubject<ReadonlySet<CardId>>(this.ids);

  /** Observable snapshot of the seen set. Emits on every markSeen / clear. */
  readonly seen$: Observable<ReadonlySet<CardId>> = this.subject.asObservable();

  constructor(private storage: StorageService) {
    const persisted = this.storage.getJSON<CardId[]>(STORAGE_KEY, []);
    for (const id of persisted) this.ids.add(id);
    this.subject.next(this.ids);
  }

  /** Mark a single card id as seen. No-op when already seen. */
  markSeen(id: CardId): void {
    if (this.ids.has(id)) return;
    this.ids.add(id);
    this.persist();
    this.subject.next(this.ids);
  }

  /** Batch variant — single persist + emit for a group of ids. */
  markSeenMany(ids: readonly CardId[]): void {
    let mutated = false;
    for (const id of ids) {
      if (!this.ids.has(id)) {
        this.ids.add(id);
        mutated = true;
      }
    }
    if (mutated) {
      this.persist();
      this.subject.next(this.ids);
    }
  }

  hasSeen(id: CardId): boolean {
    return this.ids.has(id);
  }

  getAll(): ReadonlySet<CardId> {
    return this.ids;
  }

  /** Dev-only: reset the seen set. Exposed through the library UI clear button. */
  clear(): void {
    if (this.ids.size === 0) return;
    this.ids.clear();
    this.persist();
    this.subject.next(this.ids);
  }

  private persist(): void {
    this.storage.setJSON(STORAGE_KEY, Array.from(this.ids));
  }
}

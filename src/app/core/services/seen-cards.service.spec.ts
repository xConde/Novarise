import { TestBed } from '@angular/core/testing';
import { SeenCardsService } from './seen-cards.service';
import { StorageService } from './storage.service';
import { CardId } from '../../run/models/card.model';

describe('SeenCardsService', () => {
  let service: SeenCardsService;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeenCardsService, StorageService],
    });
    // Clear localStorage between tests to isolate seen sets.
    localStorage.removeItem('novarise_seen_cards');
    storage = TestBed.inject(StorageService);
    service = TestBed.inject(SeenCardsService);
  });

  afterEach(() => {
    localStorage.removeItem('novarise_seen_cards');
  });

  it('starts with an empty seen set when localStorage is empty', () => {
    expect(service.getAll().size).toBe(0);
  });

  it('rehydrates from localStorage on construction', () => {
    localStorage.setItem('novarise_seen_cards', JSON.stringify([CardId.TOWER_BASIC, CardId.HANDSHAKE]));
    const freshService = new SeenCardsService(storage);
    expect(freshService.hasSeen(CardId.TOWER_BASIC)).toBe(true);
    expect(freshService.hasSeen(CardId.HANDSHAKE)).toBe(true);
  });

  it('markSeen adds a card id', () => {
    service.markSeen(CardId.TOWER_SNIPER);
    expect(service.hasSeen(CardId.TOWER_SNIPER)).toBe(true);
  });

  it('markSeen persists to localStorage', () => {
    service.markSeen(CardId.HANDSHAKE);
    const raw = localStorage.getItem('novarise_seen_cards');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toContain(CardId.HANDSHAKE);
  });

  it('markSeen is a no-op when the id is already seen (no double-persist)', () => {
    service.markSeen(CardId.TOWER_BASIC);
    const setSpy = spyOn(storage, 'setJSON').and.callThrough();
    service.markSeen(CardId.TOWER_BASIC); // duplicate
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('markSeenMany adds all provided ids', () => {
    service.markSeenMany([CardId.TOWER_BASIC, CardId.HANDSHAKE, CardId.FORMATION]);
    expect(service.getAll().size).toBe(3);
  });

  it('markSeenMany persists once for a batch (not once per id)', () => {
    const setSpy = spyOn(storage, 'setJSON').and.callThrough();
    service.markSeenMany([CardId.TOWER_BASIC, CardId.HANDSHAKE, CardId.FORMATION]);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('markSeenMany skips persist when every id was already seen', () => {
    service.markSeen(CardId.TOWER_BASIC);
    const setSpy = spyOn(storage, 'setJSON').and.callThrough();
    service.markSeenMany([CardId.TOWER_BASIC]);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('clear empties the seen set', () => {
    service.markSeenMany([CardId.TOWER_BASIC, CardId.HANDSHAKE]);
    service.clear();
    expect(service.getAll().size).toBe(0);
  });

  it('clear persists the empty state', () => {
    service.markSeen(CardId.TOWER_BASIC);
    service.clear();
    const raw = localStorage.getItem('novarise_seen_cards');
    expect(JSON.parse(raw as string)).toEqual([]);
  });

  it('seen$ observable emits on markSeen', (done) => {
    const emissions: ReadonlySet<CardId>[] = [];
    const sub = service.seen$.subscribe(snap => emissions.push(snap));
    service.markSeen(CardId.TOWER_SNIPER);
    // First emission is the initial (empty) value; second is post-mark.
    expect(emissions.length).toBe(2);
    expect(emissions[1].has(CardId.TOWER_SNIPER)).toBe(true);
    sub.unsubscribe();
    done();
  });
});

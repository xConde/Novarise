import { TestBed } from '@angular/core/testing';
import { ComboService, ComboState } from './combo.service';
import { COMBO_TIERS, COMBO_WINDOW_SECONDS } from '../constants/combo.constants';

describe('ComboService', () => {
  let service: ComboService;
  const NOW = 1_000_000; // arbitrary epoch start for tests

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ComboService] });
    service = TestBed.inject(ComboService);
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  it('should start with zero combo count', () => {
    const state = service.getState();
    expect(state.count).toBe(0);
    expect(state.totalBonusGold).toBe(0);
    expect(state.tierLabel).toBeNull();
    expect(state.lastKillBonus).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Single kill — below threshold
  // ---------------------------------------------------------------------------

  it('should return 0 bonus gold for the first kill', () => {
    const bonus = service.recordKill(NOW);
    expect(bonus).toBe(0);
  });

  it('should increment count to 1 on first kill', () => {
    service.recordKill(NOW);
    expect(service.getState().count).toBe(1);
  });

  it('should have null tierLabel below minimum threshold (2 kills)', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 500);
    expect(service.getState().tierLabel).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Combo tier thresholds
  // ---------------------------------------------------------------------------

  it('should award first-tier bonus starting at 3 kills', () => {
    const tier = COMBO_TIERS.find(t => t.minKills === 3)!;
    for (let i = 0; i < 2; i++) {
      service.recordKill(NOW + i * 100);
    }
    const bonus = service.recordKill(NOW + 200);
    expect(bonus).toBe(tier.bonusGoldPerKill);
    expect(service.getState().tierLabel).toBe(tier.label);
  });

  it('should award higher bonus at 5 kills', () => {
    const tier = COMBO_TIERS.find(t => t.minKills === 5)!;
    for (let i = 0; i < 4; i++) {
      service.recordKill(NOW + i * 100);
    }
    const bonus = service.recordKill(NOW + 400);
    expect(bonus).toBe(tier.bonusGoldPerKill);
    expect(service.getState().tierLabel).toBe(tier.label);
  });

  it('should award highest bonus at 10 kills', () => {
    const tier = COMBO_TIERS.find(t => t.minKills === 10)!;
    for (let i = 0; i < 9; i++) {
      service.recordKill(NOW + i * 100);
    }
    const bonus = service.recordKill(NOW + 900);
    expect(bonus).toBe(tier.bonusGoldPerKill);
    expect(service.getState().tierLabel).toBe(tier.label);
  });

  it('should continue awarding highest-tier bonus beyond 10 kills', () => {
    const tier = COMBO_TIERS.find(t => t.minKills === 10)!;
    for (let i = 0; i < 15; i++) {
      service.recordKill(NOW + i * 100);
    }
    expect(service.getState().lastKillBonus).toBe(tier.bonusGoldPerKill);
    expect(service.getState().tierLabel).toBe(tier.label);
  });

  // ---------------------------------------------------------------------------
  // Accumulated totalBonusGold
  // ---------------------------------------------------------------------------

  it('should accumulate totalBonusGold across a streak', () => {
    // 2 kills with no bonus, then 3rd kill earns bonus
    const tier3 = COMBO_TIERS.find(t => t.minKills === 3)!;
    for (let i = 0; i < 3; i++) {
      service.recordKill(NOW + i * 100);
    }
    expect(service.getState().totalBonusGold).toBe(tier3.bonusGoldPerKill);
  });

  // ---------------------------------------------------------------------------
  // Window expiry via recordKill
  // ---------------------------------------------------------------------------

  it('should reset combo when time between kills exceeds COMBO_WINDOW_SECONDS', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 500);
    service.recordKill(NOW + 900);
    // Gap larger than window
    const windowMs = COMBO_WINDOW_SECONDS * 1000 + 1;
    service.recordKill(NOW + 900 + windowMs);
    // Combo reset to 1 (fresh kill)
    expect(service.getState().count).toBe(1);
  });

  it('should return 0 bonus after window expires and restarted at 1', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 500);
    service.recordKill(NOW + 900);
    const windowMs = COMBO_WINDOW_SECONDS * 1000 + 1;
    const bonus = service.recordKill(NOW + 900 + windowMs);
    expect(bonus).toBe(0); // count is 1, below threshold
  });

  it('should NOT expire combo if gap is exactly at the boundary (not yet expired)', () => {
    service.recordKill(NOW);
    // Exactly at window — not expired yet (uses > not >=)
    const bonus = service.recordKill(NOW + COMBO_WINDOW_SECONDS * 1000);
    expect(service.getState().count).toBe(2);
    expect(bonus).toBe(0); // still only 2 kills
  });

  // ---------------------------------------------------------------------------
  // tick() expiry
  // ---------------------------------------------------------------------------

  it('should expire combo via tick() after window elapses', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 500);
    service.recordKill(NOW + 800); // count = 3, in tier
    expect(service.getState().tierLabel).not.toBeNull();

    service.tick(NOW + 800 + COMBO_WINDOW_SECONDS * 1000 + 1);
    expect(service.getState().count).toBe(0);
    expect(service.getState().tierLabel).toBeNull();
    expect(service.getState().totalBonusGold).toBe(0);
  });

  it('should NOT expire combo via tick() if window has not elapsed', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 500);
    service.recordKill(NOW + 800);
    service.tick(NOW + 800 + 500); // half a second later — window still open
    expect(service.getState().count).toBe(3);
  });

  it('tick() should be a no-op when combo count is 0', () => {
    service.tick(NOW + 99999);
    expect(service.getState().count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // reset()
  // ---------------------------------------------------------------------------

  it('should clear all state on reset()', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 100);
    service.recordKill(NOW + 200);
    service.reset();
    const state = service.getState();
    expect(state.count).toBe(0);
    expect(state.totalBonusGold).toBe(0);
    expect(state.tierLabel).toBeNull();
    expect(state.lastKillBonus).toBe(0);
  });

  it('should allow new combo to start after reset()', () => {
    service.recordKill(NOW);
    service.recordKill(NOW + 100);
    service.recordKill(NOW + 200);
    service.reset();
    service.recordKill(NOW + 300);
    expect(service.getState().count).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Observable state emission
  // ---------------------------------------------------------------------------

  it('should emit updated state via getState$()', (done) => {
    const emitted: ComboState[] = [];
    const sub = service.getState$().subscribe(s => emitted.push(s));

    service.recordKill(NOW);
    service.recordKill(NOW + 100);

    sub.unsubscribe();
    expect(emitted.length).toBeGreaterThanOrEqual(2);
    expect(emitted[emitted.length - 1].count).toBe(2);
    done();
  });

  // ---------------------------------------------------------------------------
  // lastKillBonus accuracy
  // ---------------------------------------------------------------------------

  it('should correctly report lastKillBonus for each tier transition', () => {
    // Kill 1-2: no bonus
    service.recordKill(NOW);
    service.recordKill(NOW + 100);
    expect(service.getState().lastKillBonus).toBe(0);

    // Kill 3: first tier
    const tier3 = COMBO_TIERS.find(t => t.minKills === 3)!;
    service.recordKill(NOW + 200);
    expect(service.getState().lastKillBonus).toBe(tier3.bonusGoldPerKill);

    // Kill 5: second tier
    const tier5 = COMBO_TIERS.find(t => t.minKills === 5)!;
    service.recordKill(NOW + 300);
    service.recordKill(NOW + 400);
    expect(service.getState().lastKillBonus).toBe(tier5.bonusGoldPerKill);

    // Kill 10: top tier
    const tier10 = COMBO_TIERS.find(t => t.minKills === 10)!;
    for (let i = 5; i < 10; i++) {
      service.recordKill(NOW + i * 100);
    }
    expect(service.getState().lastKillBonus).toBe(tier10.bonusGoldPerKill);
  });
});

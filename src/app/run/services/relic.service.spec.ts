import { TestBed } from '@angular/core/testing';
import { RelicService } from './relic.service';
import { RelicId, RelicRarity, RELIC_DEFINITIONS } from '../models/relic.model';
import { TowerType } from '../../game/game-board/models/tower.model';

describe('RelicService', () => {
  let service: RelicService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RelicService],
    });
    service = TestBed.inject(RelicService);
  });

  afterEach(() => {
    service.clearRelics();
  });

  // ── Baseline ─────────────────────────────────────────────────

  it('should return 1.0 damage multiplier with no relics', () => {
    expect(service.getDamageMultiplier()).toBe(1);
  });

  it('should return 1.0 range multiplier with no relics', () => {
    expect(service.getRangeMultiplier()).toBe(1);
  });

  it('should return 0.5 sell refund rate with no relics', () => {
    expect(service.getSellRefundRate()).toBe(0.5);
  });

  it('should return 1.0 gold multiplier with no relics', () => {
    expect(service.getGoldMultiplier()).toBe(1);
  });

  it('should return 1.0 enemy speed multiplier with no relics', () => {
    expect(service.getEnemySpeedMultiplier()).toBe(1);
  });

  // ── setActiveRelics ──────────────────────────────────────────

  it('should activate valid relic IDs', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER, RelicId.QUICK_DRAW]);
    expect(service.hasRelic(RelicId.COMMANDERS_BANNER)).toBeTrue();
    expect(service.hasRelic(RelicId.QUICK_DRAW)).toBeTrue();
  });

  it('should ignore unknown relic IDs without throwing', () => {
    expect(() => service.setActiveRelics(['NOT_A_RELIC'])).not.toThrow();
    expect(service.relicCount).toBe(0);
  });

  it('should replace previous active set on second call', () => {
    service.setActiveRelics([RelicId.QUICK_DRAW]);
    service.setActiveRelics([RelicId.IRON_HEART]);
    expect(service.hasRelic(RelicId.QUICK_DRAW)).toBeFalse();
    expect(service.hasRelic(RelicId.IRON_HEART)).toBeTrue();
  });

  // ── clearRelics ───────────────────────────────────────────────

  it('clearRelics() should reset all modifiers to baseline', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER, RelicId.QUICK_DRAW, RelicId.SALVAGE_KIT]);
    service.clearRelics();

    expect(service.getDamageMultiplier()).toBe(1);
    expect(service.getSellRefundRate()).toBe(0.5);
    expect(service.relicCount).toBe(0);
  });

  // ── COMMANDERS_BANNER ─────────────────────────────────────────

  it('getDamageMultiplier() returns 1.15 with COMMANDERS_BANNER', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER]);
    expect(service.getDamageMultiplier()).toBeCloseTo(1.15, 5);
  });

  it('getRangeMultiplier() returns 1.15 with COMMANDERS_BANNER', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER]);
    expect(service.getRangeMultiplier()).toBeCloseTo(1.15, 5);
  });

  // ── BASIC_TRAINING ────────────────────────────────────────────

  it('getDamageMultiplier(BASIC) returns 1.35 with BASIC_TRAINING', () => {
    service.setActiveRelics([RelicId.BASIC_TRAINING]);
    expect(service.getDamageMultiplier(TowerType.BASIC)).toBeCloseTo(1.35, 5);
  });

  it('getDamageMultiplier(SNIPER) returns 1.0 with BASIC_TRAINING (other tower type)', () => {
    service.setActiveRelics([RelicId.BASIC_TRAINING]);
    expect(service.getDamageMultiplier(TowerType.SNIPER)).toBeCloseTo(1.0, 5);
  });

  // ── QUICK_DRAW ────────────────────────────────────────────────

  it('hasQuickDraw() returns false when QUICK_DRAW not owned', () => {
    expect(service.hasQuickDraw()).toBeFalse();
  });

  it('hasQuickDraw() returns true when QUICK_DRAW is owned', () => {
    service.setActiveRelics([RelicId.QUICK_DRAW]);
    expect(service.hasQuickDraw()).toBeTrue();
  });

  it('hasQuickDraw() returns false after relics are cleared', () => {
    service.setActiveRelics([RelicId.QUICK_DRAW]);
    service.clearRelics();
    expect(service.hasQuickDraw()).toBeFalse();
  });

  // ── SNIPER_SCOPE ──────────────────────────────────────────────

  it('getRangeMultiplier(SNIPER) returns 1.25 with SNIPER_SCOPE', () => {
    service.setActiveRelics([RelicId.SNIPER_SCOPE]);
    expect(service.getRangeMultiplier(TowerType.SNIPER)).toBeCloseTo(1.25, 5);
  });

  it('getRangeMultiplier(BASIC) returns 1.0 with SNIPER_SCOPE', () => {
    service.setActiveRelics([RelicId.SNIPER_SCOPE]);
    expect(service.getRangeMultiplier(TowerType.BASIC)).toBeCloseTo(1.0, 5);
  });

  // ── SALVAGE_KIT ───────────────────────────────────────────────

  it('getSellRefundRate() returns 0.75 with SALVAGE_KIT', () => {
    service.setActiveRelics([RelicId.SALVAGE_KIT]);
    expect(service.getSellRefundRate()).toBe(0.75);
  });

  // ── BOUNTY_HUNTER ─────────────────────────────────────────────

  it('getGoldMultiplier(true) returns 2.0 with BOUNTY_HUNTER on elite kill', () => {
    service.setActiveRelics([RelicId.BOUNTY_HUNTER]);
    expect(service.getGoldMultiplier(true)).toBeCloseTo(2.0, 5);
  });

  it('getGoldMultiplier(false) returns 1.0 with BOUNTY_HUNTER on non-elite kill', () => {
    service.setActiveRelics([RelicId.BOUNTY_HUNTER]);
    expect(service.getGoldMultiplier(false)).toBeCloseTo(1.0, 5);
  });

  // ── STURDY_BOOTS ──────────────────────────────────────────────

  it('getEnemySpeedMultiplier() returns 0.92 with STURDY_BOOTS', () => {
    service.setActiveRelics([RelicId.STURDY_BOOTS]);
    expect(service.getEnemySpeedMultiplier()).toBeCloseTo(0.92, 5);
  });

  // ── ARCHITECTS_BLUEPRINT (trigger-based) ─────────────────────

  it('isNextTowerFree() returns false when ARCHITECTS_BLUEPRINT not active', () => {
    expect(service.isNextTowerFree()).toBeFalse();
  });

  it('isNextTowerFree() returns true before use with ARCHITECTS_BLUEPRINT', () => {
    service.setActiveRelics([RelicId.ARCHITECTS_BLUEPRINT]);
    expect(service.isNextTowerFree()).toBeTrue();
  });

  it('isNextTowerFree() returns false after consumeFreeTower()', () => {
    service.setActiveRelics([RelicId.ARCHITECTS_BLUEPRINT]);
    service.consumeFreeTower();
    expect(service.isNextTowerFree()).toBeFalse();
  });

  it('resetEncounterState() restores free tower availability', () => {
    service.setActiveRelics([RelicId.ARCHITECTS_BLUEPRINT]);
    service.consumeFreeTower();
    service.resetEncounterState();
    expect(service.isNextTowerFree()).toBeTrue();
  });

  // ── REINFORCED_WALLS (trigger-based) ─────────────────────────

  it('shouldBlockLeak() returns false when REINFORCED_WALLS not active', () => {
    expect(service.shouldBlockLeak()).toBeFalse();
  });

  it('shouldBlockLeak() returns true for first leak with REINFORCED_WALLS', () => {
    service.setActiveRelics([RelicId.REINFORCED_WALLS]);
    expect(service.shouldBlockLeak()).toBeTrue();
  });

  it('shouldBlockLeak() returns false for second leak same wave', () => {
    service.setActiveRelics([RelicId.REINFORCED_WALLS]);
    service.shouldBlockLeak(); // consume first block
    expect(service.shouldBlockLeak()).toBeFalse();
  });

  it('resetWaveState() allows shouldBlockLeak() to return true again', () => {
    service.setActiveRelics([RelicId.REINFORCED_WALLS]);
    service.shouldBlockLeak(); // consume
    service.resetWaveState();
    expect(service.shouldBlockLeak()).toBeTrue();
  });

  // ── FROST_NOVA ────────────────────────────────────────────────

  it('getSlowDurationBonus() returns 0 when FROST_NOVA not owned', () => {
    expect(service.getSlowDurationBonus()).toBe(0);
  });

  it('getSlowDurationBonus() returns 1 when FROST_NOVA is owned', () => {
    service.setActiveRelics([RelicId.FROST_NOVA]);
    expect(service.getSlowDurationBonus()).toBe(1);
  });

  it('getSlowDurationBonus() returns 0 after clearRelics()', () => {
    service.setActiveRelics([RelicId.FROST_NOVA]);
    service.clearRelics();
    expect(service.getSlowDurationBonus()).toBe(0);
  });

  // ── TEMPORAL_RIFT ─────────────────────────────────────────────

  it('getTurnDelayPerWave() returns 0 when TEMPORAL_RIFT not owned', () => {
    expect(service.getTurnDelayPerWave()).toBe(0);
  });

  it('getTurnDelayPerWave() returns 1 when TEMPORAL_RIFT is owned', () => {
    service.setActiveRelics([RelicId.TEMPORAL_RIFT]);
    expect(service.getTurnDelayPerWave()).toBe(1);
  });

  it('getTurnDelayPerWave() returns 0 after clearRelics()', () => {
    service.setActiveRelics([RelicId.TEMPORAL_RIFT]);
    service.clearRelics();
    expect(service.getTurnDelayPerWave()).toBe(0);
  });

  // ── Stacking relics ───────────────────────────────────────────

  it('COMMANDERS_BANNER + BASIC_TRAINING stack correctly on basic tower damage', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER, RelicId.BASIC_TRAINING]);
    // COMMANDERS_BANNER gives 1.15 base damage, BASIC_TRAINING adds ×1.35 for BASIC
    expect(service.getDamageMultiplier(TowerType.BASIC)).toBeCloseTo(1.15 * 1.35, 5);
  });

  it('multiple gold multiplier relics stack multiplicatively', () => {
    service.setActiveRelics([RelicId.GOLD_MAGNET, RelicId.BOUNTY_HUNTER]);
    // GOLD_MAGNET: ×1.15; BOUNTY_HUNTER adds ×2 for elite
    expect(service.getGoldMultiplier(true)).toBeCloseTo(1.15 * 2, 5);
    expect(service.getGoldMultiplier(false)).toBeCloseTo(1.15, 5);
  });

  it('QUICK_DRAW + FROST_NOVA both active — each accessor returns independently correct value', () => {
    service.setActiveRelics([RelicId.QUICK_DRAW, RelicId.FROST_NOVA]);
    expect(service.hasQuickDraw()).toBeTrue();
    expect(service.getSlowDurationBonus()).toBe(1);
    expect(service.getTurnDelayPerWave()).toBe(0); // TEMPORAL_RIFT not owned
  });

  it('QUICK_DRAW + FROST_NOVA + TEMPORAL_RIFT all active simultaneously', () => {
    service.setActiveRelics([RelicId.QUICK_DRAW, RelicId.FROST_NOVA, RelicId.TEMPORAL_RIFT]);
    expect(service.hasQuickDraw()).toBeTrue();
    expect(service.getSlowDurationBonus()).toBe(1);
    expect(service.getTurnDelayPerWave()).toBe(1);
  });

  // ── getAvailableRelics ────────────────────────────────────────

  it('getAvailableRelics() returns all relics when none are owned', () => {
    const totalCount = Object.keys(RELIC_DEFINITIONS).length;
    expect(service.getAvailableRelics().length).toBe(totalCount);
  });

  it('getAvailableRelics() excludes owned relics', () => {
    const allCount = Object.keys(RELIC_DEFINITIONS).length;
    service.setActiveRelics([RelicId.COMMANDERS_BANNER, RelicId.QUICK_DRAW]);
    const available = service.getAvailableRelics();
    expect(available.length).toBe(allCount - 2);
    expect(available.find(r => r.id === RelicId.COMMANDERS_BANNER)).toBeUndefined();
    expect(available.find(r => r.id === RelicId.QUICK_DRAW)).toBeUndefined();
  });

  it('getAvailableRelics(RARE) filters to rare relics and excludes owned', () => {
    service.setActiveRelics([RelicId.COMMANDERS_BANNER]);
    const available = service.getAvailableRelics(RelicRarity.RARE);
    expect(available.every(r => r.rarity === RelicRarity.RARE)).toBeTrue();
    expect(available.find(r => r.id === RelicId.COMMANDERS_BANNER)).toBeUndefined();
  });
});

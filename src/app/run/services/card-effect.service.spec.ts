import { TestBed } from '@angular/core/testing';
import { ActiveModifier, CardEffectService, SpellContext } from './card-effect.service';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';
import { StatusEffectService } from '../../game/game-board/services/status-effect.service';
import { StatusEffectType } from '../../game/game-board/constants/status-effect.constants';
import {
  createGameStateServiceSpy,
  createEnemyServiceSpy,
  createStatusEffectServiceSpy,
  createDeckServiceSpy,
  createTestEnemy,
} from '../../game/game-board/testing';
import { DeckService } from './deck.service';
import { WavePreviewService } from '../../game/game-board/services/wave-preview.service';
import { SpellCardEffect, ModifierCardEffect } from '../models/card.model';
import { MODIFIER_STAT, ModifierStat } from '../constants/modifier-stat.constants';
import { Enemy, EnemyType } from '../../game/game-board/models/enemy.model';

// ── Helper: build spell effects ────────────────────────────────────────────

function spellEffect(spellId: string, value: number): SpellCardEffect {
  return { type: 'spell', spellId, value };
}

function modifierEffect(stat: ModifierStat, value: number, duration: number | null): ModifierCardEffect {
  return { type: 'modifier', stat, value, duration };
}

function turnModifierEffect(stat: ModifierStat, value: number, turns: number): ModifierCardEffect {
  return { type: 'modifier', stat, value, duration: turns, durationScope: 'turn' };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CardEffectService', () => {
  let service: CardEffectService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let deckServiceSpy: jasmine.SpyObj<DeckService>;
  let wavePreviewSpy: jasmine.SpyObj<WavePreviewService>;
  let enemyMap: Map<string, Enemy>;

  beforeEach(() => {
    enemyMap = new Map();
    gameStateSpy = createGameStateServiceSpy();
    enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    statusEffectSpy = createStatusEffectServiceSpy();
    statusEffectSpy.apply.and.returnValue(true);
    deckServiceSpy = createDeckServiceSpy();
    wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', [
      'addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter',
    ]);

    TestBed.configureTestingModule({
      providers: [
        CardEffectService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: EnemyService, useValue: enemyServiceSpy },
      ],
    });
    service = TestBed.inject(CardEffectService);
  });

  afterEach(() => {
    service.reset();
  });

  // ── Spell: gold_rush ──────────────────────────────────────────

  describe('applySpell — gold_rush', () => {
    it('calls addGold with the effect value', () => {
      service.applySpell(spellEffect('gold_rush', 40), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(40);
    });

    it('calls addGold with upgraded value (60)', () => {
      service.applySpell(spellEffect('gold_rush', 60), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(60);
    });
  });

  // ── Spell: repair_walls ───────────────────────────────────────

  describe('applySpell — repair_walls', () => {
    it('calls addLives with the effect value', () => {
      service.applySpell(spellEffect('repair_walls', 2), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(gameStateSpy.addLives).toHaveBeenCalledWith(2);
    });
  });

  // ── Spell: lightning_strike ───────────────────────────────────

  describe('applySpell — lightning_strike', () => {
    it('calls damageStrongestEnemy with the effect value', () => {
      service.applySpell(spellEffect('lightning_strike', 100), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(enemyServiceSpy.damageStrongestEnemy).toHaveBeenCalledWith(100);
    });
  });

  // ── Spell: frost_wave ─────────────────────────────────────────

  describe('applySpell — frost_wave', () => {
    it('calls StatusEffectService.apply(SLOW) for every non-dying enemy', () => {
      const basicEnemy = createTestEnemy('e-basic', 0, 0, 10);
      const fastEnemy = { ...createTestEnemy('e-fast', 0, 0, 10), type: EnemyType.FAST };
      // Flying immunity is enforced inside StatusEffectService.apply, not here.
      // frost_wave calls apply for all non-dying enemies; the real StatusEffectService
      // will return false for flying enemies. The spy does not enforce immunity.
      const flyingEnemy = { ...createTestEnemy('e-flying', 0, 0, 10), isFlying: true, type: EnemyType.FLYING };
      enemyMap.set(basicEnemy.id, basicEnemy);
      enemyMap.set(fastEnemy.id, fastEnemy);
      enemyMap.set(flyingEnemy.id, flyingEnemy);

      service.applySpell(spellEffect('frost_wave', 5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 3, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });

      // Phase 1 Sprint 5: spell now passes effect.value through as durationOverride.
      // All 3 non-dying enemies trigger an apply call; flying filter is inside StatusEffectService.
      expect(statusEffectSpy.apply.calls.count()).toBe(3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-basic', StatusEffectType.SLOW, 3, undefined, 5);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-fast', StatusEffectType.SLOW, 3, undefined, 5);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-flying', StatusEffectType.SLOW, 3, undefined, 5);
    });

    it('skips dying enemies', () => {
      const dyingEnemy = createTestEnemy('e-dying', 0, 0, 10);
      dyingEnemy.dying = true;
      enemyMap.set(dyingEnemy.id, dyingEnemy);

      service.applySpell(spellEffect('frost_wave', 5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });
  });

  // ── Spell: scout_ahead (grants wave-preview bonus) ────────────

  describe('applySpell — scout_ahead', () => {
    it('does not touch game state (not a gold/life effect)', () => {
      service.applySpell(spellEffect('scout_ahead', 3), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(gameStateSpy.addGold).not.toHaveBeenCalled();
      expect(gameStateSpy.addLives).not.toHaveBeenCalled();
    });

    it('forwards the effect value to wavePreviewService.addOneShotBonus', () => {
      service.applySpell(spellEffect('scout_ahead', 3), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(wavePreviewSpy.addOneShotBonus).toHaveBeenCalledOnceWith(3);
    });

    it('forwards the upgraded value (SCOUT_ELITE path) via the same spellId', () => {
      // SCOUT_ELITE routes through the same 'scout_ahead' handler with a larger value.
      service.applySpell(spellEffect('scout_ahead', 5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(wavePreviewSpy.addOneShotBonus).toHaveBeenCalledOnceWith(5);
    });
  });

  // ── Spell: overclock (adds fireRate modifier) ────────────────

  describe('applySpell — overclock', () => {
    it('registers a fireRate modifier for 1 wave', () => {
      service.applySpell(spellEffect('overclock', 0.5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0, deckService: deckServiceSpy, wavePreviewService: wavePreviewSpy });
      expect(service.hasActiveModifier(MODIFIER_STAT.FIRE_RATE)).toBeTrue();
      expect(service.getModifierValue(MODIFIER_STAT.FIRE_RATE)).toBeCloseTo(0.5);
    });
  });

  // ── applyModifier ─────────────────────────────────────────────

  describe('applyModifier', () => {
    it('registers a modifier with correct stat and value', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeTrue();
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.25);
    });

    it('stacks multiple modifiers for the same stat additively', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.10, 1));
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.35);
    });

    it('tracks different stats independently', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      service.applyModifier(modifierEffect(MODIFIER_STAT.RANGE, 0.20, 3));
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.25);
      expect(service.getModifierValue(MODIFIER_STAT.RANGE)).toBeCloseTo(0.20);
    });
  });

  // ── tickWave ──────────────────────────────────────────────────

  describe('tickWave', () => {
    it('decrements remainingWaves on all active modifiers', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      service.tickWave();
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingWaves).toBe(1);
    });

    it('removes modifiers that reach 0 remaining waves', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 1));
      service.tickWave();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
      expect(service.getActiveModifiers().length).toBe(0);
    });

    it('only removes expired modifiers, leaves others intact', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 1));
      service.applyModifier(modifierEffect(MODIFIER_STAT.RANGE, 0.20, 3));
      service.tickWave();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
      expect(service.hasActiveModifier(MODIFIER_STAT.RANGE)).toBeTrue();
    });

    it('handles multiple ticks for multi-wave duration', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 3));
      service.tickWave();
      service.tickWave();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeTrue();
      service.tickWave();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
    });

    // Phase 2 Sprints 17/18 — encounter-scoped (null duration) modifiers survive tickWave.
    it('preserves encounter-scoped modifiers (duration=null) across any number of tickWave calls', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null));
      service.applyModifier(modifierEffect(MODIFIER_STAT.LABYRINTH_MIND, 0.02, null));

      service.tickWave();
      service.tickWave();
      service.tickWave();
      service.tickWave();
      service.tickWave();

      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();
      expect(service.hasActiveModifier(MODIFIER_STAT.LABYRINTH_MIND)).toBeTrue();
      // And remaining count is still null — not decremented to some negative value.
      const anchored = service.getActiveModifiers().find(m => m.stat === MODIFIER_STAT.TERRAFORM_ANCHOR);
      expect(anchored?.remainingWaves).toBeNull();
    });

    it('reset() clears encounter-scoped modifiers (tickWave never could)', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null));
      service.reset();
      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeFalse();
    });

    it('mixed numeric + encounter-scoped: numeric expires normally, encounter-scoped survives', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 1));
      service.applyModifier(modifierEffect(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null));

      service.tickWave(); // DAMAGE expires (was 1, now 0), TERRAFORM_ANCHOR stays

      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();
    });

    // Turn-scoped modifiers MUST NOT tick via tickWave.
    it('leaves turn-scoped modifiers untouched on tickWave', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      service.tickWave();
      service.tickWave();
      service.tickWave();
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingTurns).toBe(2);
      expect(mods[0].remainingWaves).toBeNull();
    });
  });

  // ── tickTurn ──────────────────────────────────────────────────

  describe('tickTurn (turn-scoped modifiers)', () => {
    it('decrements remainingTurns on turn-scoped modifiers', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 3));
      service.tickTurn();
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingTurns).toBe(2);
    });

    it('removes turn-scoped modifiers that reach 0', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 1));
      service.tickTurn();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
    });

    it('handles multiple turn ticks until expiry', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 3));
      service.tickTurn();
      service.tickTurn();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeTrue();
      service.tickTurn();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
    });

    it('leaves wave-scoped modifiers untouched', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.RANGE, 0.20, 2));
      service.tickTurn();
      service.tickTurn();
      service.tickTurn();
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingWaves).toBe(2);
      expect(mods[0].remainingTurns).toBeUndefined();
    });

    it('leaves encounter-scoped modifiers untouched', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null));
      service.tickTurn();
      service.tickTurn();
      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();
    });

    it('mixed wave + turn + encounter: each decays on the correct tick', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 1));            // wave-scoped, 1 wave
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.RANGE, 0.20, 1));         // turn-scoped, 1 turn
      service.applyModifier(modifierEffect(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null));  // encounter-scoped

      service.tickTurn();
      // RANGE should be expired; DAMAGE and TERRAFORM_ANCHOR still active.
      expect(service.hasActiveModifier(MODIFIER_STAT.RANGE)).toBeFalse();
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeTrue();
      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();

      service.tickWave();
      // DAMAGE now expired; TERRAFORM_ANCHOR still active.
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
      expect(service.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();
    });

    it('applyModifier with durationScope=turn stores remainingTurns, not remainingWaves', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      const mods = service.getActiveModifiers();
      expect(mods[0].remainingTurns).toBe(2);
      expect(mods[0].remainingWaves).toBeNull();
    });

    it('serializeModifiers round-trips remainingTurns', () => {
      service.applyModifier(turnModifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      const snapshot = service.serializeModifiers();
      service.reset();
      service.restoreModifiers(snapshot);
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingTurns).toBe(2);
      expect(mods[0].remainingWaves).toBeNull();
    });
  });

  // ── getModifierValue ──────────────────────────────────────────

  describe('getModifierValue', () => {
    it('returns 0 when no modifiers are active for the stat', () => {
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBe(0);
    });

    it('returns the sum across multiple active modifiers', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.1, 2));
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.15, 1));
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.25);
    });
  });

  // ── reset ─────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all active modifiers', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      service.applyModifier(modifierEffect(MODIFIER_STAT.RANGE, 0.20, 3));
      service.reset();
      expect(service.getActiveModifiers().length).toBe(0);
      expect(service.hasActiveModifier(MODIFIER_STAT.DAMAGE)).toBeFalse();
      expect(service.hasActiveModifier(MODIFIER_STAT.RANGE)).toBeFalse();
    });
  });

  // ── applySpell — status-applying spells (Sprint 2b) ──────────

  function makeCtx(overrides: Partial<SpellContext> = {}): SpellContext {
    return {
      gameState: gameStateSpy,
      enemyService: enemyServiceSpy,
      statusEffectService: statusEffectSpy,
      currentTurn: 1,
      deckService: deckServiceSpy,
      wavePreviewService: wavePreviewSpy,
      ...overrides,
    };
  }

  describe('applySpell — incinerate', () => {
    it('calls statusEffectService.apply(BURN) for every non-dying enemy', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);

      // Phase 1 Sprint 5: incinerate value is now BURN duration in turns.
      service.applySpell(spellEffect('incinerate', 3), makeCtx({ currentTurn: 5 }));

      expect(statusEffectSpy.apply.calls.count()).toBe(2);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.BURN, 5, undefined, 3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e2', StatusEffectType.BURN, 5, undefined, 3);
    });

    it('passes upgraded duration value through to apply()', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);

      // Phase 1 Sprint 5: upgraded incinerate carries a longer duration.
      service.applySpell(spellEffect('incinerate', 5), makeCtx({ currentTurn: 5 }));
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.BURN, 5, undefined, 5);
    });

    it('skips dying enemies', () => {
      const dyingEnemy = createTestEnemy('dying', 0, 0, 100);
      dyingEnemy.dying = true;
      enemyMap.set(dyingEnemy.id, dyingEnemy);

      service.applySpell(spellEffect('incinerate', 0), makeCtx());

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });

    it('does not throw and calls no apply on empty enemy map', () => {
      expect(() => service.applySpell(spellEffect('incinerate', 0), makeCtx())).not.toThrow();
      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });

    it('passes the correct currentTurn from context', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);

      service.applySpell(spellEffect('incinerate', 3), makeCtx({ currentTurn: 7 }));

      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.BURN, 7, undefined, 3);
    });
  });

  describe('applySpell — toxic_spray', () => {
    it('calls statusEffectService.apply(POISON) for every non-dying enemy', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);

      // Phase 1 Sprint 5: toxic_spray value is now POISON duration in turns.
      service.applySpell(spellEffect('toxic_spray', 4), makeCtx({ currentTurn: 3 }));

      expect(statusEffectSpy.apply.calls.count()).toBe(2);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.POISON, 3, undefined, 4);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e2', StatusEffectType.POISON, 3, undefined, 4);
    });

    it('passes upgraded duration value through to apply()', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);

      // Phase 1 Sprint 5: upgraded toxic_spray carries a longer duration.
      service.applySpell(spellEffect('toxic_spray', 6), makeCtx({ currentTurn: 3 }));
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.POISON, 3, undefined, 6);
    });

    it('skips dying enemies', () => {
      const dyingEnemy = createTestEnemy('dying', 0, 0, 100);
      dyingEnemy.dying = true;
      enemyMap.set(dyingEnemy.id, dyingEnemy);

      service.applySpell(spellEffect('toxic_spray', 4), makeCtx());

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });

    it('passes the correct currentTurn from context', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);

      service.applySpell(spellEffect('toxic_spray', 4), makeCtx({ currentTurn: 9 }));

      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.POISON, 9, undefined, 4);
    });
  });

  // ── applySpell — status payoff spells (Sprint 2c) ────────────

  describe('applySpell — detonate', () => {
    it('calls damageEnemy with effect.value for each burning enemy', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) => type === StatusEffectType.BURN,
      );
      enemyServiceSpy.damageEnemy.and.returnValue({ killed: false, spawnedEnemies: [] });

      service.applySpell(spellEffect('detonate', 25), makeCtx({ currentTurn: 3 }));

      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', 25);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e2', 25);
      expect(enemyServiceSpy.damageEnemy.calls.count()).toBe(2);
    });

    it('calls removeEffect(id, BURN) for each burning enemy', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) => type === StatusEffectType.BURN,
      );
      enemyServiceSpy.damageEnemy.and.returnValue({ killed: false, spawnedEnemies: [] });

      service.applySpell(spellEffect('detonate', 25), makeCtx());

      expect(statusEffectSpy.removeEffect).toHaveBeenCalledWith('e1', StatusEffectType.BURN);
    });

    it('does NOT damage non-burning enemies', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      // e1 has BURN, e2 does not
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) => id === 'e1' && type === StatusEffectType.BURN,
      );
      enemyServiceSpy.damageEnemy.and.returnValue({ killed: false, spawnedEnemies: [] });

      service.applySpell(spellEffect('detonate', 25), makeCtx());

      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', 25);
      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalledWith('e2', jasmine.anything());
    });

    it('does NOT damage dying enemies even if they have BURN', () => {
      const dyingEnemy = createTestEnemy('dying', 0, 0, 100);
      dyingEnemy.dying = true;
      enemyMap.set(dyingEnemy.id, dyingEnemy);
      // hasEffect would return BURN for this enemy
      statusEffectSpy.hasEffect.and.callFake(
        (_id: string, type: StatusEffectType) => type === StatusEffectType.BURN,
      );

      service.applySpell(spellEffect('detonate', 25), makeCtx());

      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalled();
    });

    it('does not crash on empty enemy map', () => {
      expect(() => service.applySpell(spellEffect('detonate', 25), makeCtx())).not.toThrow();
      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalled();
    });

    it('does not call damageEnemy when no enemy has BURN', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      // hasEffect always returns false (default spy behavior)

      service.applySpell(spellEffect('detonate', 25), makeCtx());

      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalled();
      expect(statusEffectSpy.removeEffect).not.toHaveBeenCalled();
    });

    it('upgraded DETONATE uses upgraded damage value (35)', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) => type === StatusEffectType.BURN,
      );
      enemyServiceSpy.damageEnemy.and.returnValue({ killed: false, spawnedEnemies: [] });

      service.applySpell(spellEffect('detonate', 35), makeCtx());

      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', 35);
    });

    it('each of multiple burning enemies takes independent damage and gets removeEffect called', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      const e3 = createTestEnemy('e3', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      enemyMap.set(e3.id, e3);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) => type === StatusEffectType.BURN,
      );
      enemyServiceSpy.damageEnemy.and.returnValue({ killed: false, spawnedEnemies: [] });

      service.applySpell(spellEffect('detonate', 25), makeCtx());

      expect(enemyServiceSpy.damageEnemy.calls.count()).toBe(3);
      expect(statusEffectSpy.removeEffect.calls.count()).toBe(3);
      expect(statusEffectSpy.removeEffect).toHaveBeenCalledWith('e1', StatusEffectType.BURN);
      expect(statusEffectSpy.removeEffect).toHaveBeenCalledWith('e2', StatusEffectType.BURN);
      expect(statusEffectSpy.removeEffect).toHaveBeenCalledWith('e3', StatusEffectType.BURN);
    });
  });

  describe('applySpell — epidemic', () => {
    it('applies POISON to all non-dying enemies when poisoned count meets threshold (2)', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100); // already poisoned
      const e2 = createTestEnemy('e2', 0, 0, 100); // already poisoned
      const e3 = createTestEnemy('e3', 0, 0, 100); // not poisoned
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      enemyMap.set(e3.id, e3);
      // e1 and e2 have POISON
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) =>
          type === StatusEffectType.POISON && (id === 'e1' || id === 'e2'),
      );
      statusEffectSpy.apply.and.returnValue(true);

      service.applySpell(spellEffect('epidemic', 2), makeCtx({ currentTurn: 4 }));

      // Apply called for all 3 non-dying enemies (refresh for e1, e2; new for e3)
      expect(statusEffectSpy.apply.calls.count()).toBe(3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e1', StatusEffectType.POISON, 4);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e2', StatusEffectType.POISON, 4);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e3', StatusEffectType.POISON, 4);
    });

    it('does NOT apply POISON when poisoned count is below threshold (1 < 2)', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100); // poisoned
      const e2 = createTestEnemy('e2', 0, 0, 100); // not poisoned
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) =>
          type === StatusEffectType.POISON && id === 'e1',
      );

      service.applySpell(spellEffect('epidemic', 2), makeCtx());

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });

    it('with 3 poisoned enemies (threshold=2): applies POISON to all non-dying including already-poisoned', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      const e2 = createTestEnemy('e2', 0, 0, 100);
      const e3 = createTestEnemy('e3', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      enemyMap.set(e2.id, e2);
      enemyMap.set(e3.id, e3);
      statusEffectSpy.hasEffect.and.callFake(
        (_id: string, type: StatusEffectType) => type === StatusEffectType.POISON,
      );
      statusEffectSpy.apply.and.returnValue(true);

      service.applySpell(spellEffect('epidemic', 2), makeCtx({ currentTurn: 5 }));

      // All 3 get apply called (refreshes their duration)
      expect(statusEffectSpy.apply.calls.count()).toBe(3);
    });

    it('with 0 poisoned enemies: no-op', () => {
      const e1 = createTestEnemy('e1', 0, 0, 100);
      enemyMap.set(e1.id, e1);
      // hasEffect returns false by default

      service.applySpell(spellEffect('epidemic', 2), makeCtx());

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });

    it('does not apply POISON to dying enemies', () => {
      const alive = createTestEnemy('alive', 0, 0, 100);
      const dying = createTestEnemy('dying', 0, 0, 100);
      dying.dying = true;
      const poisoned = createTestEnemy('poisoned', 0, 0, 100);
      const poisoned2 = createTestEnemy('poisoned2', 0, 0, 100);
      enemyMap.set(alive.id, alive);
      enemyMap.set(dying.id, dying);
      enemyMap.set(poisoned.id, poisoned);
      enemyMap.set(poisoned2.id, poisoned2);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) =>
          type === StatusEffectType.POISON && (id === 'poisoned' || id === 'poisoned2'),
      );
      statusEffectSpy.apply.and.returnValue(true);

      service.applySpell(spellEffect('epidemic', 2), makeCtx({ currentTurn: 6 }));

      // dying enemy should NOT get apply called
      expect(statusEffectSpy.apply).not.toHaveBeenCalledWith('dying', jasmine.anything(), jasmine.anything());
      // alive, poisoned, poisoned2 should all get apply called
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('alive', StatusEffectType.POISON, 6);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('poisoned', StatusEffectType.POISON, 6);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('poisoned2', StatusEffectType.POISON, 6);
    });

    it('upgraded EPIDEMIC uses threshold=1: triggers with 1 poisoned enemy', () => {
      const poisoned = createTestEnemy('poisoned', 0, 0, 100);
      const other = createTestEnemy('other', 0, 0, 100);
      enemyMap.set(poisoned.id, poisoned);
      enemyMap.set(other.id, other);
      statusEffectSpy.hasEffect.and.callFake(
        (id: string, type: StatusEffectType) =>
          type === StatusEffectType.POISON && id === 'poisoned',
      );
      statusEffectSpy.apply.and.returnValue(true);

      // upgradedEffect has value=1 (epidemicUpgradedCriticalMass)
      service.applySpell(spellEffect('epidemic', 1), makeCtx({ currentTurn: 7 }));

      // Both enemies (poisoned + other) should receive apply
      expect(statusEffectSpy.apply.calls.count()).toBe(2);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('poisoned', StatusEffectType.POISON, 7);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('other', StatusEffectType.POISON, 7);
    });

    it('works on empty enemy map: no-op, no crash', () => {
      expect(() => service.applySpell(spellEffect('epidemic', 2), makeCtx())).not.toThrow();
      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });
  });

  // ── checkpoint serialization ──────────────────────────────

  describe('checkpoint serialization', () => {
    it('serializeModifiers() returns copy of active modifiers', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.25, 2));
      const result = service.serializeModifiers();
      expect(result.length).toBe(1);
      expect(result[0].stat).toBe(MODIFIER_STAT.DAMAGE);
      expect(result[0].value).toBeCloseTo(0.25);
      expect(result[0].remainingWaves).toBe(2);
    });

    it('serializeModifiers() returns empty array when no modifiers active', () => {
      const result = service.serializeModifiers();
      expect(result).toEqual([]);
    });

    it('restoreModifiers() replaces current modifiers', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.FIRE_RATE, 0.5, 1));
      const replacement: ActiveModifier[] = [
        { stat: MODIFIER_STAT.RANGE, value: 0.3, remainingWaves: 3 },
        { stat: MODIFIER_STAT.DAMAGE, value: 0.1, remainingWaves: 2 },
      ];
      service.restoreModifiers(replacement);
      const active = service.getActiveModifiers();
      expect(active.length).toBe(2);
      expect(service.hasActiveModifier(MODIFIER_STAT.FIRE_RATE)).toBeFalse();
      expect(active[0].stat).toBe(MODIFIER_STAT.RANGE);
      expect(active[1].stat).toBe(MODIFIER_STAT.DAMAGE);
    });

    it('getModifierValue() works after restore', () => {
      const snapshot: ActiveModifier[] = [
        { stat: MODIFIER_STAT.DAMAGE, value: 0.4, remainingWaves: 2 },
      ];
      service.restoreModifiers(snapshot);
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.4);
    });

    it('serialize → restore roundtrip preserves all fields', () => {
      service.applyModifier(modifierEffect(MODIFIER_STAT.DAMAGE, 0.2, 3));
      service.applyModifier(modifierEffect(MODIFIER_STAT.RANGE, 0.15, 1));
      service.applyModifier(modifierEffect(MODIFIER_STAT.FIRE_RATE, 0.5, 2));
      const snapshot = service.serializeModifiers();

      service.reset();
      expect(service.getActiveModifiers().length).toBe(0);

      service.restoreModifiers(snapshot);
      const restored = service.getActiveModifiers();
      expect(restored.length).toBe(3);
      expect(service.getModifierValue(MODIFIER_STAT.DAMAGE)).toBeCloseTo(0.2);
      expect(service.getModifierValue(MODIFIER_STAT.RANGE)).toBeCloseTo(0.15);
      expect(service.getModifierValue(MODIFIER_STAT.FIRE_RATE)).toBeCloseTo(0.5);
      expect(restored.find(m => m.stat === MODIFIER_STAT.DAMAGE)?.remainingWaves).toBe(3);
      expect(restored.find(m => m.stat === MODIFIER_STAT.RANGE)?.remainingWaves).toBe(1);
      expect(restored.find(m => m.stat === MODIFIER_STAT.FIRE_RATE)?.remainingWaves).toBe(2);
    });
  });

  describe('applySpell — cryo_pulse', () => {
    it('applies SLOW to the enemy with the highest distanceTraveled', () => {
      const lead = createTestEnemy('lead', 0, 0, 100);
      lead.distanceTraveled = 10;
      const trailing = createTestEnemy('trailing', 0, 0, 100);
      trailing.distanceTraveled = 3;
      enemyMap.set(lead.id, lead);
      enemyMap.set(trailing.id, trailing);

      service.applySpell(spellEffect('cryo_pulse', 1), makeCtx({ currentTurn: 2 }));

      expect(statusEffectSpy.apply.calls.count()).toBe(1);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('lead', StatusEffectType.SLOW, 2);
    });

    it('calls deckService.drawCards with effect.value', () => {
      service.applySpell(spellEffect('cryo_pulse', 1), makeCtx());

      expect(deckServiceSpy.drawCards).toHaveBeenCalledWith(1);
    });

    it('with a single enemy, applies SLOW to that enemy', () => {
      const only = createTestEnemy('only', 0, 0, 100);
      only.distanceTraveled = 5;
      enemyMap.set(only.id, only);

      service.applySpell(spellEffect('cryo_pulse', 1), makeCtx({ currentTurn: 4 }));

      expect(statusEffectSpy.apply).toHaveBeenCalledOnceWith('only', StatusEffectType.SLOW, 4);
    });

    it('with no enemies, does NOT call statusEffectService.apply but DOES call drawCards', () => {
      service.applySpell(spellEffect('cryo_pulse', 1), makeCtx());

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
      expect(deckServiceSpy.drawCards).toHaveBeenCalledWith(1);
    });

    it('skips dying enemies when selecting the lead', () => {
      const dyingLead = createTestEnemy('dying-lead', 0, 0, 100);
      dyingLead.distanceTraveled = 99;
      dyingLead.dying = true;
      const alive = createTestEnemy('alive', 0, 0, 100);
      alive.distanceTraveled = 5;
      enemyMap.set(dyingLead.id, dyingLead);
      enemyMap.set(alive.id, alive);

      service.applySpell(spellEffect('cryo_pulse', 1), makeCtx({ currentTurn: 6 }));

      expect(statusEffectSpy.apply).toHaveBeenCalledOnceWith('alive', StatusEffectType.SLOW, 6);
      expect(statusEffectSpy.apply).not.toHaveBeenCalledWith('dying-lead', jasmine.anything(), jasmine.anything());
    });

    it('upgraded cryo_pulse draws 2 cards (effect.value = 2)', () => {
      service.applySpell(spellEffect('cryo_pulse', 2), makeCtx());

      expect(deckServiceSpy.drawCards).toHaveBeenCalledWith(2);
    });
  });

  // ── Spell: detour (Sprint 14) ─────────────────────────────────

  describe('applySpell — detour', () => {
    it('calls enemyService.applyDetour via the SpellContext', () => {
      service.applySpell(spellEffect('detour', 1), makeCtx());
      expect(enemyServiceSpy.applyDetour).toHaveBeenCalledTimes(1);
    });

    it('base tier (value 1): passes damageFraction = 0 to applyDetour', () => {
      service.applySpell(spellEffect('detour', 1), makeCtx());
      expect(enemyServiceSpy.applyDetour).toHaveBeenCalledWith(0);
    });

    it('upgraded tier (value 2): passes damageFraction = 0.08 to applyDetour', () => {
      service.applySpell(spellEffect('detour', 2), makeCtx());
      expect(enemyServiceSpy.applyDetour).toHaveBeenCalledWith(0.08);
    });
  });

  // ── applyModifier — HIGH_PERCH_RANGE_BONUS (Sprint 29) ────────

  describe('applyModifier — HIGH_PERCH_RANGE_BONUS', () => {
    const HIGH_PERCH_STAT = MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS;

    it('getModifierValue returns 0 when no HIGH_PERCH modifier is active', () => {
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBe(0);
    });

    it('getModifierValue returns the bonus value after applyModifier (base: 0.25)', () => {
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 1));
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBeCloseTo(0.25, 5);
    });

    it('getModifierValue returns upgraded bonus value (0.4) when upgraded modifier is applied', () => {
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.4, 1));
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBeCloseTo(0.4, 5);
    });

    it('stacking two HIGH_PERCH copies sums additively (0.25 + 0.25 = 0.5)', () => {
      // Two copies of the same card → modifier aggregator sums them.
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 1));
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 1));
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBeCloseTo(0.5, 5);
    });

    it('modifier expires after tickWave (duration = 1)', () => {
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 1));
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBeCloseTo(0.25, 5);

      service.tickWave();

      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBe(0);
    });

    it('modifier persists on tickWave when duration > 1', () => {
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 2));
      service.tickWave();

      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBeCloseTo(0.25, 5);

      service.tickWave();

      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBe(0);
    });

    it('reset clears the HIGH_PERCH modifier', () => {
      service.applyModifier(modifierEffect(HIGH_PERCH_STAT, 0.25, 1));
      service.reset();
      expect(service.getModifierValue(HIGH_PERCH_STAT)).toBe(0);
    });
  });
});

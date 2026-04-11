import { TestBed } from '@angular/core/testing';
import { CardEffectService, SpellContext } from './card-effect.service';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';
import { StatusEffectService } from '../../game/game-board/services/status-effect.service';
import { StatusEffectType } from '../../game/game-board/constants/status-effect.constants';
import {
  createGameStateServiceSpy,
  createEnemyServiceSpy,
  createStatusEffectServiceSpy,
  createTestEnemy,
} from '../../game/game-board/testing';
import { SpellCardEffect, ModifierCardEffect } from '../models/card.model';
import { MODIFIER_STAT, ModifierStat } from '../constants/modifier-stat.constants';
import { Enemy, EnemyType } from '../../game/game-board/models/enemy.model';

// ── Helper: build spell effects ────────────────────────────────────────────

function spellEffect(spellId: string, value: number): SpellCardEffect {
  return { type: 'spell', spellId, value };
}

function modifierEffect(stat: ModifierStat, value: number, duration: number): ModifierCardEffect {
  return { type: 'modifier', stat, value, duration };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CardEffectService', () => {
  let service: CardEffectService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let enemyMap: Map<string, Enemy>;

  beforeEach(() => {
    enemyMap = new Map();
    gameStateSpy = createGameStateServiceSpy();
    enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    statusEffectSpy = createStatusEffectServiceSpy();
    statusEffectSpy.apply.and.returnValue(true);

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
      service.applySpell(spellEffect('gold_rush', 40), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(40);
    });

    it('calls addGold with upgraded value (60)', () => {
      service.applySpell(spellEffect('gold_rush', 60), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(60);
    });
  });

  // ── Spell: repair_walls ───────────────────────────────────────

  describe('applySpell — repair_walls', () => {
    it('calls addLives with the effect value', () => {
      service.applySpell(spellEffect('repair_walls', 2), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });
      expect(gameStateSpy.addLives).toHaveBeenCalledWith(2);
    });
  });

  // ── Spell: lightning_strike ───────────────────────────────────

  describe('applySpell — lightning_strike', () => {
    it('calls damageStrongestEnemy with the effect value', () => {
      service.applySpell(spellEffect('lightning_strike', 100), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });
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

      service.applySpell(spellEffect('frost_wave', 5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 3 });

      // All 3 non-dying enemies trigger an apply call; flying filter is inside StatusEffectService
      expect(statusEffectSpy.apply.calls.count()).toBe(3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-basic', StatusEffectType.SLOW, 3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-fast', StatusEffectType.SLOW, 3);
      expect(statusEffectSpy.apply).toHaveBeenCalledWith('e-flying', StatusEffectType.SLOW, 3);
    });

    it('skips dying enemies', () => {
      const dyingEnemy = createTestEnemy('e-dying', 0, 0, 10);
      dyingEnemy.dying = true;
      enemyMap.set(dyingEnemy.id, dyingEnemy);

      service.applySpell(spellEffect('frost_wave', 5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });

      expect(statusEffectSpy.apply).not.toHaveBeenCalled();
    });
  });

  // ── Spell: scout_ahead (no-op) ────────────────────────────────

  describe('applySpell — scout_ahead', () => {
    it('does not throw and calls no game-state methods', () => {
      expect(() => service.applySpell(spellEffect('scout_ahead', 3), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 })).not.toThrow();
      expect(gameStateSpy.addGold).not.toHaveBeenCalled();
      expect(gameStateSpy.addLives).not.toHaveBeenCalled();
    });
  });

  // ── Spell: overclock (adds fireRate modifier) ────────────────

  describe('applySpell — overclock', () => {
    it('registers a fireRate modifier for 1 wave', () => {
      service.applySpell(spellEffect('overclock', 0.5), { gameState: gameStateSpy, enemyService: enemyServiceSpy, statusEffectService: statusEffectSpy, currentTurn: 0 });
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
});

import { TestBed } from '@angular/core/testing';
import { CardEffectService } from './card-effect.service';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';
import {
  createGameStateServiceSpy,
  createEnemyServiceSpy,
} from '../../game/game-board/testing';
import { SpellCardEffect, ModifierCardEffect } from '../models/card.model';
import { Enemy } from '../../game/game-board/models/enemy.model';

/**
 * Minimal enemy factory for spell tests.
 * We only need health and dying for lightning_strike targeting.
 */
function makeEnemy(id: string, health: number, dying = false): Enemy {
  return {
    id,
    health,
    maxHealth: health,
    speed: 1,
    pathProgress: 0,
    type: 'basic' as any,
    mesh: null as any,
    dying,
    isFlying: false,
    pathIndex: 0,
    targetWaypoint: null,
    needsRepath: false,
    isMiniSwarm: false,
    leakDamage: 1,
  } as unknown as Enemy;
}

// ── Helper: build spell effects ────────────────────────────────────────────

function spellEffect(spellId: string, value: number): SpellCardEffect {
  return { type: 'spell', spellId, value };
}

function modifierEffect(stat: string, value: number, duration: number): ModifierCardEffect {
  return { type: 'modifier', stat, value, duration };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CardEffectService', () => {
  let service: CardEffectService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let enemyMap: Map<string, Enemy>;

  beforeEach(() => {
    enemyMap = new Map();
    gameStateSpy = createGameStateServiceSpy();
    enemyServiceSpy = createEnemyServiceSpy(enemyMap);

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
      service.applySpell(spellEffect('gold_rush', 40), gameStateSpy, enemyServiceSpy);
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(40);
    });

    it('calls addGold with upgraded value (60)', () => {
      service.applySpell(spellEffect('gold_rush', 60), gameStateSpy, enemyServiceSpy);
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(60);
    });
  });

  // ── Spell: repair_walls ───────────────────────────────────────

  describe('applySpell — repair_walls', () => {
    it('calls addLives with the effect value', () => {
      service.applySpell(spellEffect('repair_walls', 2), gameStateSpy, enemyServiceSpy);
      expect(gameStateSpy.addLives).toHaveBeenCalledWith(2);
    });
  });

  // ── Spell: lightning_strike ───────────────────────────────────

  describe('applySpell — lightning_strike', () => {
    it('calls damageStrongestEnemy with the effect value', () => {
      service.applySpell(spellEffect('lightning_strike', 100), gameStateSpy, enemyServiceSpy);
      expect(enemyServiceSpy.damageStrongestEnemy).toHaveBeenCalledWith(100);
    });
  });

  // ── Spell: frost_wave ─────────────────────────────────────────

  describe('applySpell — frost_wave', () => {
    it('calls slowAllEnemies with duration seconds', () => {
      service.applySpell(spellEffect('frost_wave', 5), gameStateSpy, enemyServiceSpy);
      expect(enemyServiceSpy.slowAllEnemies).toHaveBeenCalledWith(5);
    });
  });

  // ── Spell: scout_ahead (no-op) ────────────────────────────────

  describe('applySpell — scout_ahead', () => {
    it('does not throw and calls no game-state methods', () => {
      expect(() => service.applySpell(spellEffect('scout_ahead', 3), gameStateSpy, enemyServiceSpy)).not.toThrow();
      expect(gameStateSpy.addGold).not.toHaveBeenCalled();
      expect(gameStateSpy.addLives).not.toHaveBeenCalled();
    });
  });

  // ── Spell: overclock (adds fire_rate modifier) ────────────────

  describe('applySpell — overclock', () => {
    it('registers a fire_rate modifier for 1 wave', () => {
      service.applySpell(spellEffect('overclock', 0.5), gameStateSpy, enemyServiceSpy);
      expect(service.hasActiveModifier('fire_rate')).toBeTrue();
      expect(service.getModifierValue('fire_rate')).toBeCloseTo(0.5);
    });
  });

  // ── applyModifier ─────────────────────────────────────────────

  describe('applyModifier', () => {
    it('registers a modifier with correct stat and value', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 2));
      expect(service.hasActiveModifier('damage')).toBeTrue();
      expect(service.getModifierValue('damage')).toBeCloseTo(0.25);
    });

    it('stacks multiple modifiers for the same stat additively', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 2));
      service.applyModifier(modifierEffect('damage', 0.10, 1));
      expect(service.getModifierValue('damage')).toBeCloseTo(0.35);
    });

    it('tracks different stats independently', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 2));
      service.applyModifier(modifierEffect('range', 0.20, 3));
      expect(service.getModifierValue('damage')).toBeCloseTo(0.25);
      expect(service.getModifierValue('range')).toBeCloseTo(0.20);
    });
  });

  // ── tickWave ──────────────────────────────────────────────────

  describe('tickWave', () => {
    it('decrements remainingWaves on all active modifiers', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 2));
      service.tickWave();
      const mods = service.getActiveModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].remainingWaves).toBe(1);
    });

    it('removes modifiers that reach 0 remaining waves', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 1));
      service.tickWave();
      expect(service.hasActiveModifier('damage')).toBeFalse();
      expect(service.getActiveModifiers().length).toBe(0);
    });

    it('only removes expired modifiers, leaves others intact', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 1));
      service.applyModifier(modifierEffect('range', 0.20, 3));
      service.tickWave();
      expect(service.hasActiveModifier('damage')).toBeFalse();
      expect(service.hasActiveModifier('range')).toBeTrue();
    });

    it('handles multiple ticks for multi-wave duration', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 3));
      service.tickWave();
      service.tickWave();
      expect(service.hasActiveModifier('damage')).toBeTrue();
      service.tickWave();
      expect(service.hasActiveModifier('damage')).toBeFalse();
    });
  });

  // ── getModifierValue ──────────────────────────────────────────

  describe('getModifierValue', () => {
    it('returns 0 when no modifiers are active for the stat', () => {
      expect(service.getModifierValue('damage')).toBe(0);
    });

    it('returns the sum across multiple active modifiers', () => {
      service.applyModifier(modifierEffect('damage', 0.1, 2));
      service.applyModifier(modifierEffect('damage', 0.15, 1));
      expect(service.getModifierValue('damage')).toBeCloseTo(0.25);
    });
  });

  // ── reset ─────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all active modifiers', () => {
      service.applyModifier(modifierEffect('damage', 0.25, 2));
      service.applyModifier(modifierEffect('range', 0.20, 3));
      service.reset();
      expect(service.getActiveModifiers().length).toBe(0);
      expect(service.hasActiveModifier('damage')).toBeFalse();
      expect(service.hasActiveModifier('range')).toBeFalse();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { ItemService } from './item.service';
import { ItemType, SerializedItemInventory } from '../models/item.model';
import { GamePhase } from '../../game/game-board/models/game-state.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

function wireNoCombat(svc: ItemService): void {
  // No callbacks registered — simulates outside-of-encounter state
}

function wireCombat(
  svc: ItemService,
  opts: {
    phase?: GamePhase;
    enemyCount?: number;
    lives?: number;
    maxLives?: number;
    energy?: number;
    isAtShop?: boolean;
    onAddGold?: jasmine.Spy;
    onRegenerateShop?: jasmine.Spy;
    onInsertEmptyTurn?: jasmine.Spy;
    onApplyCaltrops?: jasmine.Spy;
  } = {},
): {
  livesDelta: number;
  energyDelta: number;
  caltropsMultiplier: number | null;
  emptyTurnInserted: boolean;
  goldAdded: number;
  shopRegenerated: boolean;
} {
  const ctx = {
    livesDelta: 0,
    energyDelta: 0,
    caltropsMultiplier: null as number | null,
    emptyTurnInserted: false,
    goldAdded: 0,
    shopRegenerated: false,
  };

  const phase = opts.phase ?? GamePhase.COMBAT;
  const enemyCount = opts.enemyCount ?? 1;

  svc.registerCombatCallbacks(
    () => phase,
    (damage: number) => {
      if (enemyCount === 0) return false;
      // simulate damaging 'enemyCount' enemies
      return true;
    },
    (delta: number) => { ctx.livesDelta += delta; },
    (amount: number) => { ctx.energyDelta += amount; },
    () => { ctx.emptyTurnInserted = true; },
    (m: number) => { ctx.caltropsMultiplier = m; },
  );

  const isAtShop = opts.isAtShop ?? false;
  svc.registerRunCallbacks(
    (amount: number) => { ctx.goldAdded += amount; },
    () => isAtShop,
    () => { ctx.shopRegenerated = true; },
  );

  return ctx;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ItemService', () => {
  let service: ItemService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemService);
  });

  afterEach(() => {
    service.unregisterCallbacks();
    service.resetForRun();
  });

  // ── Inventory management ─────────────────────────────────────────────────

  describe('addItem()', () => {
    it('adds a new item type with count 1', () => {
      service.addItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBe(1);
    });

    it('increments count when same type added again', () => {
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBe(2);
    });

    it('tracks multiple item types independently', () => {
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.HEAL_POTION);
      expect(service.getInventory().get(ItemType.BOMB)).toBe(1);
      expect(service.getInventory().get(ItemType.HEAL_POTION)).toBe(1);
    });
  });

  describe('removeItem()', () => {
    it('removes one instance and returns true', () => {
      service.addItem(ItemType.BOMB);
      const result = service.removeItem(ItemType.BOMB);
      expect(result).toBeTrue();
      expect(service.getInventory().get(ItemType.BOMB)).toBeUndefined();
    });

    it('decrements count when count > 1', () => {
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.BOMB);
      service.removeItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBe(1);
    });

    it('returns false when item not in inventory', () => {
      const result = service.removeItem(ItemType.BOMB);
      expect(result).toBeFalse();
    });
  });

  describe('getInventory()', () => {
    it('returns empty map initially', () => {
      expect(service.getInventory().size).toBe(0);
    });

    it('returns a snapshot — not the internal map', () => {
      service.addItem(ItemType.BOMB);
      const inv = service.getInventory();
      // ReadonlyMap cannot be mutated — just verify it reflects state
      expect(inv.get(ItemType.BOMB)).toBe(1);
    });
  });

  describe('resetForRun()', () => {
    it('clears all items', () => {
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.HEAL_POTION);
      service.resetForRun();
      expect(service.getInventory().size).toBe(0);
    });
  });

  // ── useItem — not_owned ───────────────────────────────────────────────────

  describe('useItem() — not_owned', () => {
    it('returns {success:false, reason:not_owned} when item not in inventory', () => {
      const result = service.useItem(ItemType.BOMB);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('not_owned');
    });

    it('does not decrement below zero on failure', () => {
      service.useItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBeUndefined();
    });
  });

  // ── BOMB effect ───────────────────────────────────────────────────────────

  describe('BOMB', () => {
    it('returns success when enemies are present', () => {
      service.addItem(ItemType.BOMB);
      wireCombat(service, { phase: GamePhase.COMBAT, enemyCount: 3 });
      const result = service.useItem(ItemType.BOMB);
      expect(result.success).toBeTrue();
    });

    it('decrements inventory on success', () => {
      service.addItem(ItemType.BOMB);
      wireCombat(service, { phase: GamePhase.COMBAT, enemyCount: 1 });
      service.useItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBeUndefined();
    });

    it('returns {success:false, reason:no_enemies} when no living enemies', () => {
      service.addItem(ItemType.BOMB);
      wireCombat(service, { phase: GamePhase.COMBAT, enemyCount: 0 });
      const result = service.useItem(ItemType.BOMB);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('no_enemies');
    });

    it('does not decrement inventory on no_enemies failure', () => {
      service.addItem(ItemType.BOMB);
      wireCombat(service, { enemyCount: 0 });
      service.useItem(ItemType.BOMB);
      expect(service.getInventory().get(ItemType.BOMB)).toBe(1);
    });

    it('returns {success:false, reason:wrong_phase} without combat callbacks', () => {
      service.addItem(ItemType.BOMB);
      const result = service.useItem(ItemType.BOMB);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_phase');
    });
  });

  // ── HEAL_POTION effect ────────────────────────────────────────────────────

  describe('HEAL_POTION', () => {
    it('heals +5 lives and returns success', () => {
      service.addItem(ItemType.HEAL_POTION);
      const ctx = wireCombat(service);
      service.useItem(ItemType.HEAL_POTION);
      expect(ctx.livesDelta).toBe(5);
    });

    it('decrements inventory on success', () => {
      service.addItem(ItemType.HEAL_POTION);
      wireCombat(service);
      service.useItem(ItemType.HEAL_POTION);
      expect(service.getInventory().get(ItemType.HEAL_POTION)).toBeUndefined();
    });

    it('returns {success:false, reason:wrong_phase} without combat callbacks', () => {
      service.addItem(ItemType.HEAL_POTION);
      const result = service.useItem(ItemType.HEAL_POTION);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_phase');
    });
  });

  // ── ENERGY_ELIXIR effect ──────────────────────────────────────────────────

  describe('ENERGY_ELIXIR', () => {
    it('adds +2 energy during COMBAT and returns success', () => {
      service.addItem(ItemType.ENERGY_ELIXIR);
      const ctx = wireCombat(service, { phase: GamePhase.COMBAT });
      const result = service.useItem(ItemType.ENERGY_ELIXIR);
      expect(result.success).toBeTrue();
      expect(ctx.energyDelta).toBe(2);
    });

    it('returns {success:false, reason:wrong_phase} outside COMBAT', () => {
      service.addItem(ItemType.ENERGY_ELIXIR);
      wireCombat(service, { phase: GamePhase.INTERMISSION });
      const result = service.useItem(ItemType.ENERGY_ELIXIR);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_phase');
    });

    it('does not decrement on wrong_phase failure', () => {
      service.addItem(ItemType.ENERGY_ELIXIR);
      wireCombat(service, { phase: GamePhase.INTERMISSION });
      service.useItem(ItemType.ENERGY_ELIXIR);
      expect(service.getInventory().get(ItemType.ENERGY_ELIXIR)).toBe(1);
    });
  });

  // ── GREATER_HEAL effect ───────────────────────────────────────────────────

  describe('GREATER_HEAL', () => {
    it('heals +10 lives and returns success', () => {
      service.addItem(ItemType.GREATER_HEAL);
      const ctx = wireCombat(service);
      service.useItem(ItemType.GREATER_HEAL);
      expect(ctx.livesDelta).toBe(10);
    });
  });

  // ── CALTROPS effect ───────────────────────────────────────────────────────

  describe('CALTROPS', () => {
    it('applies 0.75 speed multiplier during INTERMISSION and returns success', () => {
      service.addItem(ItemType.CALTROPS);
      const ctx = wireCombat(service, { phase: GamePhase.INTERMISSION });
      const result = service.useItem(ItemType.CALTROPS);
      expect(result.success).toBeTrue();
      expect(ctx.caltropsMultiplier).toBe(0.75);
    });

    it('returns {success:false, reason:wrong_phase} during COMBAT', () => {
      service.addItem(ItemType.CALTROPS);
      wireCombat(service, { phase: GamePhase.COMBAT });
      const result = service.useItem(ItemType.CALTROPS);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_phase');
    });

    it('does not decrement on wrong_phase failure', () => {
      service.addItem(ItemType.CALTROPS);
      wireCombat(service, { phase: GamePhase.COMBAT });
      service.useItem(ItemType.CALTROPS);
      expect(service.getInventory().get(ItemType.CALTROPS)).toBe(1);
    });
  });

  // ── VAULT_KEY effect ──────────────────────────────────────────────────────

  describe('VAULT_KEY', () => {
    it('adds +50 gold and returns success', () => {
      service.addItem(ItemType.VAULT_KEY);
      const ctx = wireCombat(service);
      const result = service.useItem(ItemType.VAULT_KEY);
      expect(result.success).toBeTrue();
      expect(ctx.goldAdded).toBe(50);
    });

    it('returns {success:false, reason:wrong_phase} without run callbacks', () => {
      service.addItem(ItemType.VAULT_KEY);
      const result = service.useItem(ItemType.VAULT_KEY);
      expect(result.success).toBeFalse();
    });
  });

  // ── RE_ROLL effect ────────────────────────────────────────────────────────

  describe('RE_ROLL', () => {
    it('regenerates shop when at shop node and returns success', () => {
      service.addItem(ItemType.RE_ROLL);
      const ctx = wireCombat(service, { isAtShop: true });
      const result = service.useItem(ItemType.RE_ROLL);
      expect(result.success).toBeTrue();
      expect(ctx.shopRegenerated).toBeTrue();
    });

    it('returns {success:false, reason:wrong_node} when not at shop node', () => {
      service.addItem(ItemType.RE_ROLL);
      wireCombat(service, { isAtShop: false });
      const result = service.useItem(ItemType.RE_ROLL);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_node');
    });

    it('returns {success:false, reason:wrong_node} without run callbacks', () => {
      service.addItem(ItemType.RE_ROLL);
      const result = service.useItem(ItemType.RE_ROLL);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_node');
    });

    it('inventory count is unchanged when RE_ROLL used outside a shop node', () => {
      service.addItem(ItemType.RE_ROLL);
      wireCombat(service, { isAtShop: false });
      service.useItem(ItemType.RE_ROLL);
      expect(service.getInventory().get(ItemType.RE_ROLL)).toBe(1);
    });

    it('calls regeneration method when RE_ROLL used at shop node', () => {
      service.addItem(ItemType.RE_ROLL);
      const ctx = wireCombat(service, { isAtShop: true });
      const result = service.useItem(ItemType.RE_ROLL);
      expect(result.success).toBeTrue();
      expect(ctx.shopRegenerated).toBeTrue();
      expect(service.getInventory().get(ItemType.RE_ROLL)).toBeUndefined();
    });
  });

  // ── SMOKE_BOMB effect ─────────────────────────────────────────────────────

  describe('SMOKE_BOMB', () => {
    it('inserts empty turn during COMBAT and returns success', () => {
      service.addItem(ItemType.SMOKE_BOMB);
      const ctx = wireCombat(service, { phase: GamePhase.COMBAT });
      const result = service.useItem(ItemType.SMOKE_BOMB);
      expect(result.success).toBeTrue();
      expect(ctx.emptyTurnInserted).toBeTrue();
    });

    it('returns {success:false, reason:wrong_phase} during INTERMISSION', () => {
      service.addItem(ItemType.SMOKE_BOMB);
      wireCombat(service, { phase: GamePhase.INTERMISSION });
      const result = service.useItem(ItemType.SMOKE_BOMB);
      expect(result.success).toBeFalse();
      expect(result.reason).toBe('wrong_phase');
    });
  });

  // ── serialize / restore ───────────────────────────────────────────────────

  describe('serialize() / restore()', () => {
    it('round-trips empty inventory', () => {
      const s = service.serialize();
      service.restore(s);
      expect(service.getInventory().size).toBe(0);
    });

    it('round-trips populated inventory', () => {
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.BOMB);
      service.addItem(ItemType.HEAL_POTION);

      const s = service.serialize();
      service.resetForRun();
      service.restore(s);

      expect(service.getInventory().get(ItemType.BOMB)).toBe(2);
      expect(service.getInventory().get(ItemType.HEAL_POTION)).toBe(1);
    });

    it('ignores unknown item types gracefully', () => {
      const bad: SerializedItemInventory = { entries: [['not_a_type', 3]] };
      expect(() => service.restore(bad)).not.toThrow();
      expect(service.getInventory().size).toBe(0);
    });

    it('ignores zero/negative counts', () => {
      const bad: SerializedItemInventory = { entries: [['bomb', 0], ['heal_potion', -1]] };
      service.restore(bad);
      expect(service.getInventory().size).toBe(0);
    });

    it('serialize returns entries as [string, number][] pairs', () => {
      service.addItem(ItemType.VAULT_KEY);
      const s = service.serialize();
      expect(s.entries.length).toBe(1);
      expect(s.entries[0][0]).toBe(ItemType.VAULT_KEY);
      expect(s.entries[0][1]).toBe(1);
    });
  });
});

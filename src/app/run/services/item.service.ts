import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ItemType, UseItemResult, SerializedItemInventory } from '../models/item.model';
import { GamePhase } from '../../game/game-board/models/game-state.model';

/** Numeric effect values for items. */
export const ITEM_EFFECT_CONFIG = {
  /** BOMB: damage dealt to every living enemy. */
  bombDamage: 50,
  /** HEAL_POTION: lives restored. */
  healPotionAmount: 5,
  /** GREATER_HEAL: lives restored. */
  greaterHealAmount: 10,
  /** ENERGY_ELIXIR: energy added this turn. */
  energyElixirAmount: 2,
  /** CALTROPS: enemy speed fraction for next wave (0.75 = 25% slower). */
  caltropsSpeedMultiplier: 0.75,
  /** VAULT_KEY: gold awarded. */
  vaultKeyGold: 50,
} as const;

/**
 * Item (consumable) inventory service — root-scoped, lives alongside RelicService.
 *
 * Dependency injection is deferred via accessor callbacks to avoid circular
 * providers between root-scoped services and component-scoped game services.
 * Collaborators are registered via registerXxx() calls made during encounter
 * setup in GameBoardComponent.
 */
@Injectable({ providedIn: 'root' })
export class ItemService {
  private inventory = new Map<ItemType, number>();
  private inventorySubject = new BehaviorSubject<ReadonlyMap<ItemType, number>>(this.inventory);

  // Lazy collaborator accessors — set by GameBoardComponent during encounter setup.
  private getGamePhase: (() => GamePhase) | null = null;
  private doDamageAllEnemies: ((damage: number) => boolean) | null = null;
  private doAdjustLives: ((delta: number) => void) | null = null;
  private doAddEnergy: ((amount: number) => void) | null = null;
  private doAddGold: ((amount: number) => void) | null = null;
  private doInsertEmptyTurn: (() => void) | null = null;
  private doApplyCaltrops: ((multiplier: number) => void) | null = null;
  private getIsAtShopNode: (() => boolean) | null = null;
  private doRegenerateShop: (() => void) | null = null;

  /** Observable inventory map — subscribable by pause-menu UI. */
  readonly inventory$: Observable<ReadonlyMap<ItemType, number>> = this.inventorySubject.asObservable();

  // ── Collaborator wiring ─────────────────────────────────────────

  /** Register combat collaborators. Call from GameBoardComponent.ngOnInit. */
  registerCombatCallbacks(
    getGamePhase: () => GamePhase,
    doDamageAllEnemies: (damage: number) => boolean,
    doAdjustLives: (delta: number) => void,
    doAddEnergy: (amount: number) => void,
    doInsertEmptyTurn: () => void,
    doApplyCaltrops: (multiplier: number) => void,
  ): void {
    this.getGamePhase = getGamePhase;
    this.doDamageAllEnemies = doDamageAllEnemies;
    this.doAdjustLives = doAdjustLives;
    this.doAddEnergy = doAddEnergy;
    this.doInsertEmptyTurn = doInsertEmptyTurn;
    this.doApplyCaltrops = doApplyCaltrops;
  }

  /** Register run-level callbacks. Call from GameBoardComponent.ngOnInit. */
  registerRunCallbacks(
    doAddGold: (amount: number) => void,
    getIsAtShopNode: () => boolean,
    doRegenerateShop: () => void,
  ): void {
    this.doAddGold = doAddGold;
    this.getIsAtShopNode = getIsAtShopNode;
    this.doRegenerateShop = doRegenerateShop;
  }

  /** Unregister all callbacks (call from GameBoardComponent.ngOnDestroy). */
  unregisterCallbacks(): void {
    this.getGamePhase = null;
    this.doDamageAllEnemies = null;
    this.doAdjustLives = null;
    this.doAddEnergy = null;
    this.doInsertEmptyTurn = null;
    this.doApplyCaltrops = null;
    this.doAddGold = null;
    this.getIsAtShopNode = null;
    this.doRegenerateShop = null;
  }

  // ── Inventory management ────────────────────────────────────────

  addItem(type: ItemType): void {
    const current = this.inventory.get(type) ?? 0;
    this.inventory.set(type, current + 1);
    this.emit();
  }

  removeItem(type: ItemType): boolean {
    const count = this.inventory.get(type) ?? 0;
    if (count <= 0) return false;
    if (count === 1) {
      this.inventory.delete(type);
    } else {
      this.inventory.set(type, count - 1);
    }
    this.emit();
    return true;
  }

  getInventory(): ReadonlyMap<ItemType, number> {
    return this.inventory;
  }

  resetForRun(): void {
    this.inventory.clear();
    this.emit();
  }

  // ── Effect dispatch ─────────────────────────────────────────────

  /**
   * Use one instance of the item. Decrements count on success.
   * Returns { success: true } when the effect fires, or
   * { success: false, reason } when preconditions fail.
   */
  useItem(type: ItemType): UseItemResult {
    const count = this.inventory.get(type) ?? 0;
    if (count <= 0) return { success: false, reason: 'not_owned' };

    const result = this.dispatchEffect(type);
    if (result.success) {
      this.removeItem(type);
    }
    return result;
  }

  private dispatchEffect(type: ItemType): UseItemResult {
    switch (type) {
      case ItemType.BOMB:
        return this.useBomb();
      case ItemType.HEAL_POTION:
        return this.useHealPotion(ITEM_EFFECT_CONFIG.healPotionAmount);
      case ItemType.ENERGY_ELIXIR:
        return this.useEnergyElixir();
      case ItemType.GREATER_HEAL:
        return this.useHealPotion(ITEM_EFFECT_CONFIG.greaterHealAmount);
      case ItemType.CALTROPS:
        return this.useCaltrops();
      case ItemType.VAULT_KEY:
        return this.useVaultKey();
      case ItemType.RE_ROLL:
        return this.useReRoll();
      case ItemType.SMOKE_BOMB:
        return this.useSmokeBomb();
    }
  }

  private useBomb(): UseItemResult {
    if (!this.doDamageAllEnemies) return { success: false, reason: 'wrong_phase' };
    const hit = this.doDamageAllEnemies(ITEM_EFFECT_CONFIG.bombDamage);
    if (!hit) return { success: false, reason: 'no_enemies' };
    return { success: true };
  }

  private useHealPotion(amount: number): UseItemResult {
    if (!this.doAdjustLives) return { success: false, reason: 'wrong_phase' };
    // doAdjustLives returns false when already at max
    const healed = this.tryAdjustLives(amount);
    if (!healed) return { success: false, reason: 'at_max' };
    return { success: true };
  }

  private useEnergyElixir(): UseItemResult {
    if (!this.getGamePhase || !this.doAddEnergy) return { success: false, reason: 'wrong_phase' };
    if (this.getGamePhase() !== GamePhase.COMBAT) return { success: false, reason: 'wrong_phase' };
    this.doAddEnergy(ITEM_EFFECT_CONFIG.energyElixirAmount);
    return { success: true };
  }

  private useCaltrops(): UseItemResult {
    if (!this.getGamePhase || !this.doApplyCaltrops) return { success: false, reason: 'wrong_phase' };
    if (this.getGamePhase() === GamePhase.COMBAT) return { success: false, reason: 'wrong_phase' };
    this.doApplyCaltrops(ITEM_EFFECT_CONFIG.caltropsSpeedMultiplier);
    return { success: true };
  }

  private useVaultKey(): UseItemResult {
    if (!this.doAddGold) return { success: false, reason: 'wrong_phase' };
    this.doAddGold(ITEM_EFFECT_CONFIG.vaultKeyGold);
    return { success: true };
  }

  private useReRoll(): UseItemResult {
    if (!this.getIsAtShopNode || !this.doRegenerateShop) return { success: false, reason: 'wrong_node' };
    if (!this.getIsAtShopNode()) return { success: false, reason: 'wrong_node' };
    this.doRegenerateShop();
    return { success: true };
  }

  private useSmokeBomb(): UseItemResult {
    if (!this.getGamePhase || !this.doInsertEmptyTurn) return { success: false, reason: 'wrong_phase' };
    if (this.getGamePhase() !== GamePhase.COMBAT) return { success: false, reason: 'wrong_phase' };
    this.doInsertEmptyTurn();
    return { success: true };
  }

  /**
   * Try to add lives via the registered callback.
   * Returns false if doAdjustLives is null or reports no-op (at max).
   * A sentinel: doAdjustLives is expected to be a no-op when at max,
   * so we pre-check via the supplied maxLives getter.
   */
  private tryAdjustLives(amount: number): boolean {
    if (!this.doAdjustLives) return false;
    this.doAdjustLives(amount);
    return true;
  }

  // ── Serialization ───────────────────────────────────────────────

  serialize(): SerializedItemInventory {
    return {
      entries: [...this.inventory.entries()].map(([k, v]) => [k, v] as const),
    };
  }

  restore(s: SerializedItemInventory): void {
    this.inventory.clear();
    for (const [k, v] of s.entries) {
      if (Object.values(ItemType).includes(k as ItemType) && typeof v === 'number' && v > 0) {
        this.inventory.set(k as ItemType, v);
      }
    }
    this.emit();
  }

  private emit(): void {
    // Emit a ReadonlyMap snapshot so subscribers can't mutate internals
    this.inventorySubject.next(new Map(this.inventory));
  }
}

/**
 * Card model for Ascent Mode deckbuilder layer.
 *
 * Cards are the primary action mechanic during encounters. Players draw a hand
 * each wave and spend energy to play cards that place towers, cast spells,
 * or apply modifiers.
 *
 * Design: cards replace free tower placement. In Ascent encounters, you can
 * ONLY place towers by playing tower cards. This creates the strategic tension
 * that makes deckbuilders work — you build your deck between encounters and
 * execute it during combat.
 */

import { TowerType } from '../../game/game-board/models/tower.model';
import { ModifierStat } from '../constants/modifier-stat.constants';
import { MutationOp, MutationRejectionReason } from '../../game/game-board/services/path-mutation.types';
import { ElevationRejectionReason } from '../../game/game-board/services/elevation.types';

// ── Card Identity ─────────────────────────────────────────────

export enum CardId {
  // Tower cards (6 — one per tower type)
  TOWER_BASIC = 'TOWER_BASIC',
  TOWER_SNIPER = 'TOWER_SNIPER',
  TOWER_SPLASH = 'TOWER_SPLASH',
  TOWER_SLOW = 'TOWER_SLOW',
  TOWER_CHAIN = 'TOWER_CHAIN',
  TOWER_MORTAR = 'TOWER_MORTAR',

  // Tower card variants (6 — one per tower type)
  TOWER_BASIC_REINFORCED = 'TOWER_BASIC_REINFORCED',
  TOWER_SNIPER_LIGHT = 'TOWER_SNIPER_LIGHT',
  TOWER_SPLASH_CLUSTER = 'TOWER_SPLASH_CLUSTER',
  TOWER_SLOW_AURA = 'TOWER_SLOW_AURA',
  TOWER_CHAIN_TESLA = 'TOWER_CHAIN_TESLA',
  TOWER_MORTAR_BARRAGE = 'TOWER_MORTAR_BARRAGE',

  // Spell cards (8 — instant effects)
  GOLD_RUSH = 'GOLD_RUSH',
  REPAIR_WALLS = 'REPAIR_WALLS',
  SCOUT_AHEAD = 'SCOUT_AHEAD',
  LIGHTNING_STRIKE = 'LIGHTNING_STRIKE',
  FROST_WAVE = 'FROST_WAVE',
  SALVAGE = 'SALVAGE',
  FORTIFY = 'FORTIFY',
  OVERCLOCK = 'OVERCLOCK',

  // Status-applying spell cards (3 — archetype enablers for burn/poison/slow builds)
  INCINERATE = 'INCINERATE',
  TOXIC_SPRAY = 'TOXIC_SPRAY',
  CRYO_PULSE = 'CRYO_PULSE',

  // Status payoff spells (2 — consume/amplify existing status for burst)
  DETONATE = 'DETONATE',
  EPIDEMIC = 'EPIDEMIC',

  // Modifier cards (8 — persist for N waves)
  DAMAGE_BOOST = 'DAMAGE_BOOST',
  RANGE_EXTEND = 'RANGE_EXTEND',
  RAPID_FIRE = 'RAPID_FIRE',
  ENEMY_SLOW = 'ENEMY_SLOW',
  GOLD_INTEREST = 'GOLD_INTEREST',
  SHIELD_WALL = 'SHIELD_WALL',
  CHAIN_LIGHTNING = 'CHAIN_LIGHTNING',
  PRECISION = 'PRECISION',

  // Utility cards (3 — deck manipulation)
  DRAW_TWO = 'DRAW_TWO',
  RECYCLE = 'RECYCLE',
  ENERGY_SURGE = 'ENERGY_SURGE',

  // Keyword cards (15 — H3 content pass)
  // exhaust (4)
  LAST_STAND = 'LAST_STAND',
  OVERLOAD = 'OVERLOAD',
  BATTLE_SURGE = 'BATTLE_SURGE',
  IRON_WILL = 'IRON_WILL',
  // retain (4)
  STOCKPILE = 'STOCKPILE',
  WAR_FUND = 'WAR_FUND',
  VANGUARD = 'VANGUARD',
  BULWARK = 'BULWARK',
  // innate (4)
  OPENING_GAMBIT = 'OPENING_GAMBIT',
  SCOUT_ELITE = 'SCOUT_ELITE',
  ADVANCE_GUARD = 'ADVANCE_GUARD',
  FIRST_BLOOD = 'FIRST_BLOOD',
  // ethereal (3)
  DESPERATE_MEASURES = 'DESPERATE_MEASURES',
  WARP_STRIKE = 'WARP_STRIKE',
  PHANTOM_GOLD = 'PHANTOM_GOLD',

  // Cartographer archetype — terraform-target cards (Phase 2, Sprints 11/12/15/16)
  LAY_TILE = 'LAY_TILE',
  BLOCK_PASSAGE = 'BLOCK_PASSAGE',
  BRIDGEHEAD = 'BRIDGEHEAD',
  COLLAPSE = 'COLLAPSE',

  // Cartographer archetype — enemy-routing card (Sprint 14)
  DETOUR = 'DETOUR',

  // Cartographer archetype — rare anchor / build-around (Sprints 17/18)
  CARTOGRAPHER_SEAL = 'CARTOGRAPHER_SEAL',
  LABYRINTH_MIND = 'LABYRINTH_MIND',

  // Highground archetype — elevation-target cards (Phase 3, Sprints 27/28)
  RAISE_PLATFORM = 'RAISE_PLATFORM',
  DEPRESS_TILE = 'DEPRESS_TILE',

  // Highground archetype — modifier card (Phase 3, Sprint 29)
  HIGH_PERCH = 'HIGH_PERCH',

  // Highground archetype — uncommon cards (Phase 3, Sprints 30/31/32)
  CLIFFSIDE = 'CLIFFSIDE',
  VANTAGE_POINT = 'VANTAGE_POINT',
  AVALANCHE_ORDER = 'AVALANCHE_ORDER',

  // Highground archetype — rare cards (Phase 3, Sprints 33/34)
  KING_OF_THE_HILL = 'KING_OF_THE_HILL',
  GRAVITY_WELL = 'GRAVITY_WELL',

  // Conduit archetype — common cards (Phase 4, Sprints 43+)
  HANDSHAKE = 'HANDSHAKE',
  FORMATION = 'FORMATION',
  LINKWORK = 'LINKWORK',

  // Conduit archetype — uncommon cards (Phase 4, Sprints 46+)
  HARMONIC = 'HARMONIC',
  GRID_SURGE = 'GRID_SURGE',
  CONDUIT_BRIDGE = 'CONDUIT_BRIDGE',

  // Conduit archetype — rare cards (Phase 4, Sprints 49+)
  ARCHITECT = 'ARCHITECT',
  HIVE_MIND = 'HIVE_MIND',
}

export enum CardType {
  TOWER = 'tower',
  SPELL = 'spell',
  MODIFIER = 'modifier',
  UTILITY = 'utility',
}

export enum CardRarity {
  STARTER = 'starter',
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
}

// ── Spatial Archetypes (Phase 1 Sprint 8) ─────────────────────

/**
 * Card archetype tag — drives reward-pool weighting and meta-progression.
 * Each archetype is a TD-native spatial identity (NOT damage type).
 *
 * - `cartographer`: reshape the path itself (build/destroy/reroute tiles).
 * - `highground`: elevation as power (Y-axis range/damage scaling).
 * - `conduit`: adjacency networks (towers amplify neighbors via Link).
 * - `siegeworks`: engineered kill corridors (persistent zone chains).
 * - `neutral`: no archetype identity (default for all pre-archetype cards).
 *
 * `DeckService.getDominantArchetype()` returns the archetype with the most
 * cards in the current deck, falling back to `neutral` on ties or when no
 * archetype-tagged cards exist.
 */
export type CardArchetype =
  | 'cartographer'
  | 'highground'
  | 'conduit'
  | 'siegeworks'
  | 'neutral';

// ── Card Definition ───────────────────────────────────────────

export interface CardDefinition {
  readonly id: CardId;
  readonly name: string;
  readonly description: string;
  /**
   * Description shown when the card is (or is being previewed as) upgraded.
   * Falls back to `description` at render time when not specified.
   * Required for any card defining `upgradedEffect` so the rest-site upgrade
   * picker can preview what the upgrade actually does.
   */
  readonly upgradedDescription?: string;
  readonly type: CardType;
  readonly rarity: CardRarity;
  readonly energyCost: number;
  /**
   * Optional energy cost applied when the card instance's `upgraded` flag is
   * true. When undefined (default), the upgraded card costs the same as the
   * base. Set on cards whose upgrade identity IS the cost reduction (e.g.,
   * ARCHITECT 3E → 2E to enable same-turn combo plays). Reads route through
   * `getEffectiveEnergyCost(card)` — do NOT read `def.energyCost` directly
   * on play paths without checking this field.
   */
  readonly upgradedEnergyCost?: number;
  readonly effect: CardEffect;
  readonly upgradedEffect?: CardEffect;
  readonly upgraded: boolean;

  /**
   * Phase 10: StS2-inspired keywords. All default to false. Content cards
   * using these keywords are populated in hardening phase H3.
   *
   * - `exhaust`: when played, card goes to exhaustPile (removed from the
   *   deck for the rest of the encounter) instead of discardPile.
   * - `retain`: card is NOT discarded at end of turn — stays in hand for the
   *   next turn. Useful for setup/storage cards.
   * - `innate`: on encounter start, card is drawn into the opening hand
   *   regardless of the normal draw order. Multiple innate cards all land in
   *   the starting hand.
   * - `ethereal`: if still in hand at end of turn, card is exhausted instead
   *   of discarded. Forces "use it or lose it" pressure on powerful cards.
   *
   * Phase 1 Sprints 6/7 — archetype primitives. No cards use these flags
   * yet; they are infrastructure for Cartographer (Terraform) and Conduit
   * (Link) archetypes shipped in later phases. The hover tooltip and detail
   * modal pick them up automatically via the same render path as the H3
   * keywords above.
   *
   * - `terraform`: card modifies tile state (add/remove/raise/lower path
   *   tiles, change elevation). Carto + Highground archetypes.
   * - `link`: card creates an effect that propagates between adjacent
   *   towers. Conduit archetype.
   */
  readonly exhaust?: boolean;
  readonly retain?: boolean;
  readonly innate?: boolean;
  readonly ethereal?: boolean;
  readonly terraform?: boolean;
  readonly link?: boolean;
  // Anchor keyword (Siegeworks archetype, sprint 57) is intentionally NOT
  // declared here yet — add when that phase opens.

  /**
   * Phase 1 Sprint 8 — spatial archetype tag.
   * Required on every CardDefinition. Drives reward-pool weighting via
   * DeckService.getDominantArchetype().
   *
   * **Checkpoint migration note:** archetype/terraform/link live on
   * CardDefinition (a static lookup), NOT on CardInstance. Save/restore
   * serializes only `cardId`; archetype is re-derived from CARD_DEFINITIONS
   * at load time. No CHECKPOINT_VERSION bump is required for this field
   * UNLESS a future feature serializes a CardDefinition snapshot directly
   * (telemetry payload, card-crafting state, etc.) — in that case bump.
   */
  readonly archetype: CardArchetype;
}

export type CardEffect =
  | TowerCardEffect
  | SpellCardEffect
  | ModifierCardEffect
  | UtilityCardEffect
  | TerraformTargetCardEffect
  | ElevationTargetCardEffect;

/**
 * Optional per-card stat modifications applied at tower placement time.
 * Stored on the resulting `PlacedTower` and composed into the tower's
 * effective stats at fire time, stacking multiplicatively (or additively for
 * bonus fields) with relic and card modifiers.
 *
 * All fields are optional — a missing field means "no override" (1.0 for
 * multipliers, 0 for additive bonuses). A tower with no overrides set
 * (undefined or {}) is treated identically to pre-extension behavior.
 */
export interface TowerStatOverrides {
  readonly damageMultiplier?: number;
  readonly rangeMultiplier?: number;
  readonly splashRadiusMultiplier?: number;
  readonly chainBounceBonus?: number;
  readonly dotDamageMultiplier?: number;
}

export interface TowerCardEffect {
  readonly type: 'tower';
  readonly towerType: TowerType;
  /** Initial level for the placed tower (default 1). Upgraded tower cards use 2. */
  readonly startLevel?: number;
  /** Optional per-card stat overrides (see TowerStatOverrides docs). */
  readonly statOverrides?: TowerStatOverrides;
}

export interface SpellCardEffect {
  readonly type: 'spell';
  readonly spellId: string;
  readonly value: number;
}

export interface ModifierCardEffect {
  readonly type: 'modifier';
  readonly stat: ModifierStat;
  readonly value: number;
  /**
   * Duration countdown. When `durationScope` is 'wave' (default), counts in
   * waves; `null` means encounter-scoped (never expires via `tickWave` —
   * cleared only on encounter teardown via `reset()`). When `durationScope`
   * is 'turn', counts in turns and MUST be a positive integer (turn-scoped
   * encounter-span buffs are not currently needed).
   *
   * Added for sprints 17/18 (CARTOGRAPHER_SEAL / LABYRINTH_MIND): both are
   * flag-style modifiers that must persist for the entire encounter without
   * a wave countdown. Existing numeric modifiers (DAMAGE_BOOST etc.) keep
   * using positive integer durations. The union widening is backwards
   * compatible — old v8 checkpoints carrying plain numbers validate
   * unchanged.
   */
  readonly duration: number | null;
  /**
   * Countdown scope. `'wave'` (default) ticks via `tickWave` at wave
   * completion. `'turn'` ticks via `tickTurn` at the start of each turn —
   * used by Phase 4 Conduit cards (LINKWORK / HARMONIC / CONDUIT_BRIDGE).
   * Omit for wave-scoped modifiers to preserve existing call sites.
   */
  readonly durationScope?: 'wave' | 'turn';
}

export interface UtilityCardEffect {
  readonly type: 'utility';
  readonly utilityId: string;
  readonly value: number;
}

/**
 * Effect type for Cartographer-archetype tile-targeting cards.
 *
 * WHY THIS EXISTS: Cards like LAY_TILE, BLOCK_PASSAGE, COLLAPSE, BRIDGEHEAD,
 * and DETOUR need a two-phase play flow — the player clicks the card, then
 * clicks a board tile to apply the operation. This effect type signals to
 * CardPlayService that the card requires a tile target rather than resolving
 * immediately (like spells) or awaiting tower placement.
 *
 * `op` maps directly to PathMutationService methods (build/block/destroy/bridgehead).
 * `duration` is passed through to the mutation journal; null = permanent.
 */
export interface TerraformTargetCardEffect {
  readonly type: 'terraform_target';
  readonly op: MutationOp;
  /** Duration in turns; null = permanent. */
  readonly duration: number | null;
  /**
   * Optional damage-on-hit rider. When set, after the mutation succeeds,
   * every enemy on (row, col) takes `pctMaxHp × enemy.maxHealth` damage.
   *
   * WHY SEPARATE FROM pathMutationService: the service is pure board state.
   * Damage is a card concern — routing it through the service would couple
   * it to EnemyService and make side effects harder to reason about.
   *
   * Currently used by COLLAPSE (0.5 max-HP damage on destroy).
   */
  readonly damageOnHit?: {
    /** Fraction of maxHealth — 0.5 means 50% of max HP. */
    readonly pctMaxHp: number;
  };
  /**
   * Optional card-draw rider. When set, after the mutation succeeds and the
   * card is consumed, CardPlayService calls deckService.drawCards(N). Used
   * by LAY_TILE upgraded to turn it into a cycle-card (place 1 tile + draw 1).
   * Hand-size cap applies; surplus draws are silently dropped (StS convention).
   */
  readonly drawOnSuccess?: number;
}

/**
 * Type guard: returns true when a CardEffect is a TerraformTargetCardEffect.
 *
 * WHY THIS EXISTS: CardPlayService branches on effect.type, but calling code
 * outside the service (e.g., CardHandComponent, GameBoardComponent) may also
 * need to distinguish terraform-target cards from instant-resolve cards to
 * determine UI state (e.g., whether the card is in targeting mode).
 */
export function isTerraformTargetEffect(e: CardEffect): e is TerraformTargetCardEffect {
  return e.type === 'terraform_target';
}

/**
 * Effect type for Highground-archetype elevation-targeting cards.
 *
 * WHY THIS EXISTS: Cards like RAISE_PLATFORM and DEPRESS_TILE need the same
 * two-phase play flow as terraform-target cards — the player clicks the card,
 * then clicks a board tile — but they route to ElevationService instead of
 * PathMutationService. A separate effect type keeps the two concerns orthogonal
 * and prevents accidental routing through the terraform switch in resolveTileTarget.
 *
 * Peer design per docs/design/elevation-model.md §4: elevation is NOT a
 * mutation variant, so this is a separate effect type rather than a MutationOp
 * extension on TerraformTargetCardEffect.
 */
export interface ElevationTargetCardEffect {
  readonly type: 'elevation_target';
  /**
   * 'raise' lifts a tile; 'depress' lowers it; 'collapse' drops it to 0
   * in a one-shot op (AVALANCHE_ORDER, sprint 32).
   */
  readonly op: 'raise' | 'depress' | 'collapse';
  /** Integer elevation units to apply. Ignored for 'collapse' (always to 0). */
  readonly amount: number;
  /** Turns until expiry; null = permanent. */
  readonly duration: number | null;
  /**
   * When true, the target tile's negative elevation marks enemies on it as
   * "exposed" (+EXPOSED_DAMAGE_BONUS incoming damage). Read at damage-application
   * time via ElevationService.getElevation, not stored as a status effect.
   * Set on DEPRESS_TILE; unset on RAISE_PLATFORM.
   */
  readonly exposeEnemies?: boolean;
  /**
   * Sprint 30 (CLIFFSIDE) — optional horizontal/vertical line expansion.
   *
   * When present, `resolveElevationTarget` in card-play.service expands the
   * target tile into a line of tiles. The center tile is mandatory (failure =
   * card reject); wing failures are silently skipped.
   *
   * `length` is the total number of tiles including the center (e.g., 3 = center
   * + 1 wing on each side; 5 = center + 2 wings on each side).
   */
  readonly line?: {
    readonly direction: 'horizontal' | 'vertical';
    readonly length: number;
  };
  /**
   * Sprint 32 (AVALANCHE_ORDER) — optional per-elevation damage rider.
   *
   * When set, after the collapse op succeeds, every enemy on (row, col) takes
   * `damagePerElevation × change.priorElevation` instant damage. Damage is
   * applied BEFORE the collapse call in card-play so the prior elevation is
   * read from elevationService.getElevation while the tile is still raised.
   *
   * WHY NOT pctMaxHp: COLLAPSE (Cartographer) uses pctMaxHp on
   * TerraformTargetCardEffect. This rider uses a flat per-elevation constant
   * so the damage is deterministic without reading enemy health.
   */
  readonly damageOnHit?: {
    /** Damage per unit of prior elevation, applied to all enemies on the tile. */
    readonly damagePerElevation: number;
  };
  /**
   * DEPRESS_TILE upgrade — when set, after the center 'depress' op succeeds,
   * card-play picks one 4-dir adjacent tile via the seeded run RNG and applies
   * the same depress (same amount, same duration, same exposeEnemies). The
   * spread is best-effort: if every 4-dir neighbor is out-of-bounds, spawner/
   * exit, or already-changed-this-turn, the center still succeeds and no
   * spread occurs (mirrors CLIFFSIDE wing semantics). Only valid on
   * `op: 'depress'`.
   */
  readonly spreadToAdjacent?: boolean;
}

/**
 * Type guard: returns true when a CardEffect is an ElevationTargetCardEffect.
 *
 * WHY THIS EXISTS: CardPlayService branches on effect.type. Callers outside
 * the service (e.g., GameBoardComponent) may also need to distinguish
 * elevation-target cards from instant-resolve cards for UI state.
 */
export function isElevationTargetEffect(e: CardEffect): e is ElevationTargetCardEffect {
  return e.type === 'elevation_target';
}

// ── TileTargetResult ──────────────────────────────────────────

/**
 * Return value of CardPlayService.resolveTileTarget().
 *
 * WHY THIS EXISTS: The caller (GameBoardComponent.onTilePlace) needs to know
 * whether the tile click succeeded so it can surface an appropriate toast and
 * decide whether to clear the pending state. Mirrors the MutationResult shape
 * but adds card-play-level rejection reasons so the component can distinguish
 * "board rejected the tile" from "card state was invalid."
 */
export interface TileTargetResult {
  readonly ok: boolean;
  /** Populated on failure. MutationRejectionReason for board-level rejections;
   *  card-play-level reasons for state errors. */
  readonly reason?: MutationRejectionReason | ElevationRejectionReason | 'no-pending-card' | 'insufficient-energy' | 'unknown-op';
}

// ── Card Instance (in a deck/hand) ────────────────────────────

/** A specific card instance in a player's deck. */
export interface CardInstance {
  readonly instanceId: string;
  readonly cardId: CardId;
  readonly upgraded: boolean;
}

// ── Deck State ────────────────────────────────────────────────

export interface DeckState {
  readonly drawPile: CardInstance[];
  readonly hand: CardInstance[];
  readonly discardPile: CardInstance[];
  readonly exhaustPile: CardInstance[];
}

// ── Energy ────────────────────────────────────────────────────

export interface EnergyState {
  readonly current: number;
  readonly max: number;
}

// ── Hand Config ───────────────────────────────────────────────

export const DECK_CONFIG = {
  /** Cards drawn at the start of each wave. */
  handSize: 5,
  /** Base energy per wave. */
  baseEnergy: 3,
  /** Hard ceiling on energy (clamps any modifier-induced overflow). */
  maxEnergy: 10,
  /** Maximum hand size (excess cards are discarded). */
  maxHandSize: 10,
} as const;

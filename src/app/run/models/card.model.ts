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
   * Defaults to `'neutral'` when undefined. Drives reward-pool weighting via
   * DeckService.getDominantArchetype().
   *
   * **Checkpoint migration note:** archetype/terraform/link live on
   * CardDefinition (a static lookup), NOT on CardInstance. Save/restore
   * serializes only `cardId`; archetype is re-derived from CARD_DEFINITIONS
   * at load time. No CHECKPOINT_VERSION bump is required for this field
   * UNLESS a future feature serializes a CardDefinition snapshot directly
   * (telemetry payload, card-crafting state, etc.) — in that case bump.
   */
  readonly archetype?: CardArchetype;
}

export type CardEffect =
  | TowerCardEffect
  | SpellCardEffect
  | ModifierCardEffect
  | UtilityCardEffect;

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
  readonly duration: number;
}

export interface UtilityCardEffect {
  readonly type: 'utility';
  readonly utilityId: string;
  readonly value: number;
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
  /** Maximum hand size (excess cards are discarded). */
  maxHandSize: 10,
} as const;

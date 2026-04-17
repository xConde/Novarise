/**
 * Encounter model for Ascent Mode.
 *
 * An encounter is a single combat node within a run. EncounterConfig
 * wraps the wave/map data needed to start a game board session.
 *
 * RewardItem is a discriminated union — currently only relics and gold.
 * When cards are added, add a { type: 'card' } variant here.
 */

import { WaveDefinition } from '../../game/game-board/models/wave.model';
import { NodeType } from './node-map.model';
import { RelicId } from './relic.model';
import { CardId } from './card.model';
import { ChallengeDefinition } from '../data/challenges';

export interface EncounterConfig {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly campaignMapId: string;
  readonly waves: WaveDefinition[];
  readonly goldReward: number;
  readonly isElite: boolean;
  readonly isBoss: boolean;
}

/** Reward offered after a combat encounter. */
export type RewardItem = RelicReward | GoldReward | CardReward;

export interface RelicReward {
  readonly type: 'relic';
  readonly relicId: RelicId;
}

export interface GoldReward {
  readonly type: 'gold';
  readonly amount: number;
}

export interface CardReward {
  readonly type: 'card';
  readonly cardId: CardId;
}

/** Reward screen config generated after encounter victory. */
export interface RewardScreenConfig {
  readonly goldPickup: number;
  readonly relicChoices: RelicReward[];
  readonly cardChoices: CardReward[];
  readonly bonusRewards: RewardItem[];
  /**
   * Challenges completed on the just-finished encounter. `goldPickup` already
   * includes the gold bonus from these (see RunService.generateRewards).
   * This field is for UI display — a reward-screen update in a follow-up
   * sprint will render a "Challenges completed" breakdown section.
   */
  readonly completedChallenges: readonly ChallengeDefinition[];
  /** Node type of the completed encounter — drives the card-skip gold amount. */
  readonly nodeType: NodeType;
}

/** Shop item in a shop node. */
export interface ShopItem {
  readonly item: RewardItem;
  readonly cost: number;
}

/** Rest node options. */
export enum RestOption {
  HEAL = 'heal',
  UPGRADE_TOWER = 'upgrade_tower',
}

export interface RestConfig {
  readonly healAmount: number;
  readonly healPercentage: number;
}

/** Event node: a narrative choice with outcomes. */
export interface RunEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly choices: EventChoice[];
}

export interface EventChoice {
  readonly label: string;
  readonly description: string;
  readonly outcome: EventOutcome;
}

export interface EventOutcome {
  readonly goldDelta: number;
  readonly livesDelta: number;
  readonly relicId?: RelicId;
  readonly removeRelicId?: RelicId;
  /** When true, resolveEvent removes a random non-starter card from the deck. */
  readonly removeCard?: boolean;
  readonly description: string;
  /**
   * Optional gamble: if present, resolveEvent rolls rng against winChance.
   * On win, goldDelta is replaced by winGoldDelta; on loss, by loseGoldDelta.
   * The base goldDelta field is ignored when gamble is present.
   */
  readonly gamble?: {
    readonly winGoldDelta: number;
    readonly loseGoldDelta: number;
    readonly winChance: number;
  };
}

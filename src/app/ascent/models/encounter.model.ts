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
export type RewardItem = RelicReward | GoldReward;

export interface RelicReward {
  readonly type: 'relic';
  readonly relicId: RelicId;
}

export interface GoldReward {
  readonly type: 'gold';
  readonly amount: number;
}

/** Reward screen config generated after encounter victory. */
export interface RewardScreenConfig {
  readonly goldPickup: number;
  readonly relicChoices: RelicReward[];
  readonly bonusRewards: RewardItem[];
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
  readonly description: string;
}

/**
 * Item model for Novarise consumable one-shots.
 *
 * Items are run-scoped consumables the player can stockpile and use strategically.
 * Effect logic lives in ItemService.useItem(); this file is data only.
 */

export enum ItemType {
  BOMB = 'bomb',
  HEAL_POTION = 'heal_potion',
  ENERGY_ELIXIR = 'energy_elixir',
  GREATER_HEAL = 'greater_heal',
  CALTROPS = 'caltrops',
  VAULT_KEY = 'vault_key',
  RE_ROLL = 're_roll',
  SMOKE_BOMB = 'smoke_bomb',
}

export interface Item {
  readonly type: ItemType;
  readonly name: string;
  readonly description: string;
  /** shared-icon name used in the UI. */
  readonly icon: string;
}

export const ITEM_DEFINITIONS: Record<ItemType, Item> = {
  [ItemType.BOMB]: {
    type: ItemType.BOMB,
    name: 'Bomb',
    description: 'Deal 50 damage to every enemy on the board.',
    icon: 'damage',
  },
  [ItemType.HEAL_POTION]: {
    type: ItemType.HEAL_POTION,
    name: 'Heal Potion',
    description: 'Restore 5 lives (up to your max).',
    icon: 'lives',
  },
  [ItemType.ENERGY_ELIXIR]: {
    type: ItemType.ENERGY_ELIXIR,
    name: 'Energy Elixir',
    description: 'Gain +2 energy this turn (combat only).',
    icon: 'energy',
  },
  [ItemType.GREATER_HEAL]: {
    type: ItemType.GREATER_HEAL,
    name: 'Greater Heal',
    description: 'Restore 10 lives (up to your max).',
    icon: 'lives',
  },
  [ItemType.CALTROPS]: {
    type: ItemType.CALTROPS,
    name: 'Caltrops',
    description: 'Enemies in the next wave move 25% slower.',
    icon: 'slow',
  },
  [ItemType.VAULT_KEY]: {
    type: ItemType.VAULT_KEY,
    name: 'Vault Key',
    description: 'Gain 50 gold immediately.',
    icon: 'gold',
  },
  [ItemType.RE_ROLL]: {
    type: ItemType.RE_ROLL,
    name: 'Re-roll',
    description: 'Refresh the current shop inventory (shop only).',
    icon: 'upgrade',
  },
  [ItemType.SMOKE_BOMB]: {
    type: ItemType.SMOKE_BOMB,
    name: 'Smoke Bomb',
    description: 'Insert 1 empty spawn turn this wave (combat only).',
    icon: 'slow',
  },
};

/** Result returned by ItemService.useItem(). */
export interface UseItemResult {
  readonly success: boolean;
  readonly reason?: 'not_owned' | 'no_enemies' | 'at_max' | 'wrong_phase' | 'wrong_node';
}

/** Serialized form stored in EncounterCheckpoint. */
export interface SerializedItemInventory {
  /** Map entries as [ItemType, count][] pairs. */
  readonly entries: ReadonlyArray<readonly [string, number]>;
}

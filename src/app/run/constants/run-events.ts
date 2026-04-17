/**
 * Event definitions for Ascent Mode EVENT nodes.
 *
 * Each event presents a narrative choice with trade-off outcomes.
 * StS-faithful design: events are opportunities with risk, not free rewards.
 *
 * Events with `outcome.removeCard: true` trigger a random card removal in RunService.resolveEvent.
 * Events with `outcome.itemReward` grant a consumable item to the player's inventory.
 * Events with `requiresFlag`/`requiresFlagAbsent` participate in chained event sequences.
 * Events with `outcome.setsFlag`/`outcome.incrementsFlag` write state for future events.
 *
 * Three chains shipped (S6):
 *   A — Wandering Merchant: wandering_merchant_intro → wandering_merchant_return
 *   B — Cursed Idol:        cursed_idol_offer        → cursed_idol_reckoning
 *   C — Injured Scout:      injured_scout_encounter  → scout_returns_grateful
 */

import { RunEvent } from '../models/encounter.model';
import { RelicId } from '../models/relic.model';
import { ItemType } from '../models/item.model';
import { FLAG_KEYS } from './flag-keys';
import { EVENT_REWARD_CONFIG } from './event-reward.constants';

export const RUN_EVENTS: ReadonlyArray<RunEvent> = [
  {
    id: 'abandoned_armory',
    title: 'Abandoned Armory',
    description: 'You find a cache of old weapons, rusted but salvageable. The air hums with residual energy.',
    choices: [
      {
        label: 'Salvage the weapons',
        description: 'Gain 40 gold from scrap.',
        outcome: { goldDelta: 40, livesDelta: 0, description: 'You pocket the salvage.' },
      },
      {
        label: 'Search deeper',
        description: 'Risk 2 lives for a chance at something better.',
        outcome: { goldDelta: 80, livesDelta: -2, description: 'The deeper cache yields richer spoils — but at a cost.' },
      },
    ],
  },
  // Chain A — Part 1: fires only if merchant_aided flag is absent (one-shot intro)
  {
    id: 'wandering_merchant_intro',
    title: 'Wandering Merchant',
    description: 'A hooded traveller sits by the roadside, cart overturned. They look up hopefully — a small favour and they could be back on their way.',
    requiresFlagAbsent: FLAG_KEYS.MERCHANT_AIDED,
    choices: [
      {
        label: 'Help them right the cart',
        description: `Spend a moment helping. Gain ${EVENT_REWARD_CONFIG.merchantAidGold} gold for your trouble.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.merchantAidGold,
          livesDelta: 0,
          setsFlag: FLAG_KEYS.MERCHANT_AIDED,
          description: 'The merchant thanks you warmly and presses coin into your hand.',
        },
      },
      {
        label: 'Walk on by',
        description: 'You have bigger concerns.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'The merchant watches you go in silence.' },
      },
    ],
  },
  // Chain A — Part 2: fires only if merchant_aided flag is set
  {
    id: 'wandering_merchant_return',
    title: 'Merchant Returns the Favour',
    description: 'The merchant you helped earlier appears again — stall fully stocked this time. They insist on giving you a deal you cannot refuse.',
    requiresFlag: FLAG_KEYS.MERCHANT_AIDED,
    choices: [
      {
        label: 'Accept the gift',
        description: `The merchant hands over a free relic and ${EVENT_REWARD_CONFIG.merchantReturnGold} gold for being a good soul.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.merchantReturnGold,
          livesDelta: 0,
          relicId: RelicId.FIELD_RATIONS,
          description: 'Field Rations and a pouch of coin — a fair return on a small kindness.',
        },
      },
      {
        label: 'Decline graciously',
        description: 'Helping was its own reward.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'The merchant bows and wishes you luck.' },
      },
    ],
  },
  {
    id: 'healing_spring',
    title: 'Healing Spring',
    description: 'Crystal-clear water pools between ancient stones. Its glow suggests restorative properties.',
    choices: [
      {
        label: 'Drink deeply',
        description: 'Restore 4 lives.',
        outcome: { goldDelta: 0, livesDelta: 4, description: 'Warmth spreads through you.' },
      },
      {
        label: 'Bottle it for later',
        description: 'Gain 25 gold instead.',
        outcome: { goldDelta: 25, livesDelta: 0, description: 'The water fetches a fair price.' },
      },
    ],
  },
  // Chain B — Part 1: fires only if idol_bargain_taken flag is absent
  {
    id: 'cursed_idol_offer',
    title: 'Cursed Idol',
    description: 'A dark statue pulses with energy. A whisper promises gold — lots of it — but you sense strings attached.',
    requiresFlagAbsent: FLAG_KEYS.IDOL_BARGAIN_TAKEN,
    choices: [
      {
        label: 'Take the bargain',
        description: `Gain ${EVENT_REWARD_CONFIG.idolBargainGold} gold. The idol remembers.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.idolBargainGold,
          livesDelta: 0,
          setsFlag: FLAG_KEYS.IDOL_BARGAIN_TAKEN,
          description: 'Gold floods your purse. The idol\'s eyes seem to follow you as you leave.',
        },
      },
      {
        label: 'Refuse',
        description: 'Some debts are not worth taking on.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'The whisper fades. Wisdom, perhaps.' },
      },
    ],
  },
  // Chain B — Part 2: fires only if idol_bargain_taken flag is set
  {
    id: 'cursed_idol_reckoning',
    title: 'The Idol\'s Reckoning',
    description: 'The same dark statue blocks the path — except now it seems angry. The debt from your earlier bargain is due.',
    requiresFlag: FLAG_KEYS.IDOL_BARGAIN_TAKEN,
    choices: [
      {
        label: 'Pay in blood',
        description: `Lose ${EVENT_REWARD_CONFIG.idolReckoningLivesCost} lives to satisfy the idol.`,
        outcome: {
          goldDelta: 0,
          livesDelta: -EVENT_REWARD_CONFIG.idolReckoningLivesCost,
          description: 'The idol drinks deep. You stagger onward, lighter in spirit and body.',
        },
      },
      {
        label: 'Pay in gold',
        description: `Lose ${EVENT_REWARD_CONFIG.idolReckoningGoldCost} gold to buy your way out.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.idolReckoningGoldCost,
          livesDelta: 0,
          description: 'The idol accepts the coin. A debt settled — barely.',
        },
      },
    ],
  },
  {
    id: 'trapped_sentinel',
    title: 'Trapped Sentinel',
    description: 'A mechanical guardian lies pinned under rubble. It gestures weakly, offering its core in exchange for freedom.',
    choices: [
      {
        label: 'Free the sentinel',
        description: 'Spend 30 gold on tools. Gain a powerful gift.',
        outcome: { goldDelta: -30, livesDelta: 0, relicId: RelicId.QUICK_DRAW, description: 'The sentinel grants you Quick Draw before powering down forever.' },
      },
      {
        label: 'Scavenge its parts',
        description: 'Gain 60 gold from components.',
        outcome: { goldDelta: 60, livesDelta: 0, description: 'Its parts will serve your cause.' },
      },
    ],
  },
  {
    id: 'mysterious_fog',
    title: 'Mysterious Fog',
    description: 'A thick fog rolls in. Shadows move within it. You could wait it out, or press forward.',
    choices: [
      {
        label: 'Push through',
        description: 'Lose 1 life but gain 50 gold found in the mist.',
        outcome: { goldDelta: 50, livesDelta: -1, description: 'You emerge richer but scratched.' },
      },
      {
        label: 'Wait patiently',
        description: 'The fog lifts after an hour. Nothing gained, nothing lost.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'Patience is its own strategy.' },
      },
    ],
  },
  {
    id: 'ancient_library',
    title: 'Ancient Library',
    description: 'Dusty tomes line shelves that stretch to the ceiling. One book glows faintly.',
    choices: [
      {
        label: 'Study the glowing tome',
        description: 'Gain a relic, but the knowledge costs you.',
        outcome: { goldDelta: 0, livesDelta: -2, relicId: RelicId.SCOUTING_LENS, description: 'The Scouting Lens reveals what others miss.' },
      },
      {
        label: 'Sell rare books',
        description: 'Gain 70 gold from the collection.',
        outcome: { goldDelta: 70, livesDelta: 0, description: 'Knowledge has its price — and so do rare editions.' },
      },
    ],
  },
  {
    id: 'gambling_den',
    title: 'Gambling Den',
    description: 'A makeshift table. A grinning figure shuffles cards. "Double or nothing?"',
    choices: [
      {
        label: 'Gamble (50/50)',
        description: '50% chance to gain 80 gold. Lose: gain nothing.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The cards are dealt.',
          gamble: { winGoldDelta: 80, loseGoldDelta: 0, winChance: 0.5 },
        },
      },
      {
        label: 'Keep walking',
        description: 'The house always wins — eventually.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'You keep your gold and your dignity.' },
      },
    ],
  },
  {
    id: 'fallen_defender',
    title: 'Fallen Defender',
    description: 'A defeated tower commander lies by the road, armor dented. They offer their last supply cache.',
    choices: [
      {
        label: 'Accept the cache',
        description: 'Gain 35 gold and restore 2 lives.',
        outcome: { goldDelta: 35, livesDelta: 2, description: 'Their sacrifice will not be forgotten.' },
      },
      {
        label: 'Give them your supplies',
        description: 'Lose 20 gold. Gain 3 lives from their gratitude.',
        outcome: { goldDelta: -20, livesDelta: 3, description: 'They share a healing technique as thanks.' },
      },
    ],
  },
  {
    id: 'crystal_cavern',
    title: 'Crystal Cavern',
    description: 'Shimmering crystals line the walls. Some are fragile. Some hum with power.',
    choices: [
      {
        label: 'Mine carefully',
        description: 'Gain 30 gold. Safe but modest.',
        outcome: { goldDelta: 30, livesDelta: 0, description: 'A cautious harvest.' },
      },
      {
        label: 'Blast the deposit',
        description: 'Gain 90 gold but the explosion costs 2 lives.',
        outcome: { goldDelta: 90, livesDelta: -2, description: 'The blast yields handsomely — and leaves scars.' },
      },
    ],
  },
  {
    id: 'crossroads_shrine',
    title: 'Crossroads Shrine',
    description: 'An ancient shrine offers a blessing to those who donate.',
    choices: [
      {
        label: 'Donate 60 gold',
        description: 'Restore to full lives.',
        outcome: { goldDelta: -60, livesDelta: 20, description: 'The shrine glows. Your wounds close.' },
      },
      {
        label: 'Take the offering bowl',
        description: 'Gain 30 gold. The shrine dims.',
        outcome: { goldDelta: 30, livesDelta: -1, description: 'A pang of guilt follows.' },
      },
    ],
  },
  {
    id: 'abandoned_blueprint',
    title: 'Abandoned Blueprint',
    description: 'Engineering schematics for an unknown device. Complex, but potentially valuable.',
    choices: [
      {
        label: 'Study the blueprint',
        description: 'Gain Apprentice Manual relic.',
        outcome: { goldDelta: 0, livesDelta: 0, relicId: RelicId.APPRENTICE_MANUAL, description: 'The schematics reveal cost-cutting techniques.' },
      },
      {
        label: 'Sell to a collector',
        description: 'Gain 55 gold.',
        outcome: { goldDelta: 55, livesDelta: 0, description: 'A collector pays well for rare prints.' },
      },
    ],
  },
  {
    id: 'echo_chamber',
    title: 'Echo Chamber',
    description: 'A chamber that amplifies sound — and power. Standing inside feels electric.',
    choices: [
      {
        label: 'Channel the energy',
        description: 'Lose 1 life, gain 60 gold from the resonance.',
        outcome: { goldDelta: 60, livesDelta: -1, description: 'The chamber thrums with released energy.' },
      },
      {
        label: 'Listen to the echoes',
        description: 'Gain insight: +20 gold.',
        outcome: { goldDelta: 20, livesDelta: 0, description: 'The echoes whisper of treasure ahead.' },
      },
    ],
  },
  {
    id: 'supply_caravan',
    title: 'Supply Caravan',
    description: 'A supply caravan has overturned on the road. Goods are scattered.',
    choices: [
      {
        label: 'Help right the caravan',
        description: 'Gain 45 gold as a reward.',
        outcome: { goldDelta: 45, livesDelta: 0, description: 'The grateful driver shares their surplus.' },
      },
      {
        label: 'Take what you need',
        description: 'Gain 75 gold. Lose 1 life from guilt.',
        outcome: { goldDelta: 75, livesDelta: -1, description: 'Necessity justifies much — but not everything.' },
      },
    ],
  },
  {
    id: 'tower_ruins',
    title: 'Tower Ruins',
    description: 'The remains of an ancient defense tower. Its foundation still holds power.',
    choices: [
      {
        label: 'Extract the power core',
        description: 'Gain a Salvage Kit relic.',
        outcome: { goldDelta: 0, livesDelta: 0, relicId: RelicId.SALVAGE_KIT, description: 'The core still functions. Barely.' },
      },
      {
        label: 'Study the architecture',
        description: 'Gain 40 gold from insights.',
        outcome: { goldDelta: 40, livesDelta: 0, description: 'Even ruins teach the observant.' },
      },
    ],
  },
  {
    id: 'card_purifier',
    title: 'The Purifier',
    description: 'A hooded figure offers to remove impurities from your arsenal. "Dead weight has no place in a warrior\'s deck."',
    choices: [
      {
        label: 'Remove a card',
        description: 'Remove one card from your deck permanently.',
        outcome: { goldDelta: -25, livesDelta: 0, removeCard: true, description: 'One card purged from your deck.' },
      },
      {
        label: 'Decline',
        description: 'Keep your deck as-is.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'You leave your deck untouched.' },
      },
    ],
  },
  {
    id: 'treasure_cache',
    title: 'Treasure Cache',
    description: 'A sealed crate bears the markings of a forward-supply depot. You can haul it out or crack it open on the spot.',
    choices: [
      {
        label: 'Crack it open',
        description: 'Take a consumable item from the cache.',
        outcome: { goldDelta: 0, livesDelta: 0, itemReward: ItemType.HEAL_POTION, description: 'You pocket a Heal Potion from the cache.' },
      },
      {
        label: 'Sell the whole crate',
        description: 'Gain 35 gold — contents unknown.',
        outcome: { goldDelta: 35, livesDelta: 0, description: 'The broker pays without asking questions.' },
      },
    ],
  },
  {
    id: 'ruined_lab',
    title: 'Ruined Laboratory',
    description: 'Shattered equipment and scattered notes. A faded journal offers two paths: burn the useless research or keep it intact.',
    choices: [
      {
        label: 'Burn the deadwood',
        description: 'Remove a card, but gain 30 gold from the cleared space.',
        outcome: { goldDelta: 30, livesDelta: 0, removeCard: true, description: 'The purge makes room for what matters.' },
      },
      {
        label: 'Preserve everything',
        description: 'Take nothing. Leave everything unchanged.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'Knowledge — even useless knowledge — has its place.' },
      },
    ],
  },

  // ── Chain C — Injured Scout ────────────────────────────────────────────────

  // Chain C — Part 1: fires only if scout_saved flag is absent (one-shot encounter)
  {
    id: 'injured_scout_encounter',
    title: 'Injured Scout',
    description: 'A scout from a forward unit slumps against a tree, arrow wound in their shoulder. They can\'t travel alone — help costs you time and gold.',
    requiresFlagAbsent: FLAG_KEYS.SCOUT_SAVED,
    choices: [
      {
        label: 'Help the scout',
        description: `Spend ${EVENT_REWARD_CONFIG.scoutHelpGoldCost} gold on field dressings. They promise to repay the debt.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.scoutHelpGoldCost,
          livesDelta: 0,
          setsFlag: FLAG_KEYS.SCOUT_SAVED,
          description: 'The scout grips your arm gratefully. "I won\'t forget this."',
        },
      },
      {
        label: 'Leave them',
        description: 'Every resource counts. The scout will have to manage.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'You press on. The scout\'s eyes follow you down the road.' },
      },
    ],
  },
  // Chain C — Part 2: fires only if scout_saved flag is set
  {
    id: 'scout_returns_grateful',
    title: 'Scout\'s Intel',
    description: 'The scout you patched up intercepts you on the road, fully recovered. They have been watching enemy movements and have something valuable to share.',
    requiresFlag: FLAG_KEYS.SCOUT_SAVED,
    choices: [
      {
        label: 'Hear them out',
        description: `Receive a full enemy wave briefing and ${EVENT_REWARD_CONFIG.scoutGratefulGold} gold for your earlier kindness.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.scoutGratefulGold,
          livesDelta: 0,
          description: 'The scout details the next wave\'s composition in full. Knowledge is the sharpest weapon.',
        },
      },
      {
        label: 'Wave them off',
        description: 'You are in a hurry.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'The scout nods and melts back into the tree line.' },
      },
    ],
  },
];

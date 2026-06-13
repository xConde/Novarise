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

import { RunEvent, EventOutcome } from '../models/encounter.model';
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
  // Chain A — Part 2: fires only if merchant_aided flag is set; once resolved, never repeats
  {
    id: 'wandering_merchant_return',
    title: 'Merchant Returns the Favour',
    description: 'The merchant you helped earlier appears again — stall fully stocked this time. They insist on giving you a deal you cannot refuse.',
    requiresFlag: FLAG_KEYS.MERCHANT_AIDED,
    firesOncePerRun: true,
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
  // Chain B — Part 2: fires only if idol_bargain_taken flag is set; once resolved, never repeats
  {
    id: 'cursed_idol_reckoning',
    title: 'The Idol\'s Reckoning',
    description: 'The same dark statue blocks the path — except now it seems angry. The debt from your earlier bargain is due.',
    requiresFlag: FLAG_KEYS.IDOL_BARGAIN_TAKEN,
    firesOncePerRun: true,
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
  // Chain C — Part 2: fires only if scout_saved flag is set; once resolved, never repeats
  {
    id: 'scout_returns_grateful',
    title: 'Scout\'s Intel',
    description: 'The scout you patched up intercepts you on the road, fully recovered. They have been watching enemy movements and have something valuable to share.',
    requiresFlag: FLAG_KEYS.SCOUT_SAVED,
    firesOncePerRun: true,
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

  // ── Chain D — Deserter ─────────────────────────────────────────────────────

  // Chain D — Part 1: fires only if deserter_encountered flag is absent
  {
    id: 'deserter_encounter',
    title: 'Deserter at the Fork',
    description: 'A soldier in crumpled fatigues blocks the path, rifle lowered but not holstered. They deserted last night. They are not here to fight — but they need something from you.',
    requiresFlagAbsent: FLAG_KEYS.DESERTER_ENCOUNTERED,
    choices: [
      {
        label: 'Pay them off',
        description: `Give them ${EVENT_REWARD_CONFIG.deserterBribeGold} gold to disappear quietly.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.deserterBribeGold,
          livesDelta: 0,
          setsFlag: FLAG_KEYS.DESERTER_ENCOUNTERED,
          description: 'They take the coin, nod once, and melt into the tree line.',
        },
      },
      {
        label: 'Turn them in',
        description: 'Report the deserter. No gold spent.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'Command is grateful. The deserter is escorted away. You feel no particular pride about it.',
        },
      },
    ],
  },
  // Chain D — Part 2: fires only if deserter_encountered flag is set; once resolved, never repeats
  {
    id: 'deserter_returns',
    title: 'The Deserter Returns',
    description: 'The soldier you paid off at the fork is back — but this time armed, composed, and wearing a different insignia. They remember your kindness. Or they remember your gold.',
    requiresFlag: FLAG_KEYS.DESERTER_ENCOUNTERED,
    firesOncePerRun: true,
    choices: [
      {
        label: 'Accept their intelligence',
        description: `They share enemy patrol routes and leave ${EVENT_REWARD_CONFIG.deserterAllyGold} gold — repaying double with interest.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.deserterAllyGold,
          livesDelta: 0,
          description: 'A debt repaid — and then some. The intelligence is solid.',
        },
      },
      {
        label: 'Refuse and move on',
        description: 'Some alliances are not worth making.',
        outcome: {
          goldDelta: 0,
          livesDelta: -EVENT_REWARD_CONFIG.deserterBetrayalLivesCost,
          description: 'They take the rebuff poorly. A thrown grenade behind you says as much.',
        },
      },
    ],
  },

  // ── Chain E — Strange Signal ───────────────────────────────────────────────

  // Chain E — Part 1: fires only if signal_received flag is absent
  {
    id: 'strange_signal',
    title: 'Strange Signal',
    description: 'Your comms crackle with an unscheduled transmission on a dead channel. Coordinates, nothing else. Following them will cost time and resources. Ignoring them might cost more.',
    requiresFlagAbsent: FLAG_KEYS.SIGNAL_RECEIVED,
    choices: [
      {
        label: 'Follow the coordinates',
        description: `Spend ${EVENT_REWARD_CONFIG.signalFollowGoldCost} gold on fuel and reconnaissance. Mark the signal as active.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.signalFollowGoldCost,
          livesDelta: 0,
          setsFlag: FLAG_KEYS.SIGNAL_RECEIVED,
          description: 'The signal leads somewhere. You log the coordinates and push forward.',
        },
      },
      {
        label: 'Discard it as noise',
        description: 'Unknown transmissions are more often decoys than treasure.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The channel goes silent. You will never know.',
        },
      },
    ],
  },
  // Chain E — Part 2: fires only if signal_received flag is set; once resolved, never repeats
  {
    id: 'signal_source_found',
    title: 'Signal Source',
    description: 'The coordinates lead to a buried supply cache — military-grade, pre-war. Whoever sent that signal wanted it found. You are glad you listened.',
    requiresFlag: FLAG_KEYS.SIGNAL_RECEIVED,
    firesOncePerRun: true,
    choices: [
      {
        label: 'Recover the cache',
        description: `Extract ${EVENT_REWARD_CONFIG.signalPayoffGold} gold in salvageable equipment and restore ${EVENT_REWARD_CONFIG.signalPayoffLivesDelta} lives from field medkits inside.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.signalPayoffGold,
          livesDelta: EVENT_REWARD_CONFIG.signalPayoffLivesDelta,
          description: 'The investment paid off. Equipment, medkits, and a mystery neatly resolved.',
        },
      },
      {
        label: 'Leave it sealed',
        description: 'Booby traps are standard practice. Some caches stay buried.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'Caution costs nothing. You mark the location and move on.',
        },
      },
    ],
  },

  // ── Archetype events ───────────────────────────────────────────────────────

  // Cartographer archetype event — eligible only when Cartographer is dominant
  {
    id: 'surveyors_find',
    title: "Surveyor's Find",
    description: 'Your scouts return with tri-fold elevation maps of the next three sectors. The terrain has been mis-charted in every briefing up to now. Accurate data is leverage.',
    requiresDominantArchetype: 'cartographer',
    choices: [
      {
        label: 'Monetise the data',
        description: `Sell the corrected survey to a logistics contractor for ${EVENT_REWARD_CONFIG.cartographerSurveyGold} gold.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.cartographerSurveyGold,
          livesDelta: 0,
          description: 'Accurate maps have always been worth more than anyone admits.',
        },
      },
      {
        label: 'Keep the advantage',
        description: 'Gain a Scouting Lens relic. Intelligence kept in-house wins engagements.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          relicId: RelicId.SCOUTING_LENS,
          description: 'The Scouting Lens extends your sight lines. The maps stay classified.',
        },
      },
    ],
  },
  // Highground archetype event — eligible only when Highground is dominant
  {
    id: 'elevated_outpost',
    title: 'Elevated Outpost',
    description: 'A derelict fire-control tower commands the high ground ahead. Its access ladder is intact but the structural bolts are questionable. The view from the top would be worth the climb.',
    requiresDominantArchetype: 'highground',
    choices: [
      {
        label: 'Secure and reinforce',
        description: `Spend ${EVENT_REWARD_CONFIG.highgroundOutpostGoldCost} gold on emergency repairs. The position restores ${EVENT_REWARD_CONFIG.highgroundOutpostLivesDelta} lives — morale counts.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.highgroundOutpostGoldCost,
          livesDelta: EVENT_REWARD_CONFIG.highgroundOutpostLivesDelta,
          description: 'Steel bolts, clean sight lines, and three soldiers who feel invincible again.',
        },
      },
      {
        label: 'Strip it for parts',
        description: 'The tower is more useful as scrap than as a risk.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          relicId: RelicId.SALVAGE_KIT,
          description: 'Every bolt counts. The Salvage Kit goes into your pack.',
        },
      },
    ],
  },
  // Conduit archetype event — eligible only when Conduit is dominant
  {
    id: 'relay_network',
    title: 'Relay Network',
    description: 'A defunct communications relay grid spans the next ridge — four towers, one active node. Your engineers say they can patch it into your command channel. It just needs a power source.',
    requiresDominantArchetype: 'conduit',
    choices: [
      {
        label: 'Restore the relay',
        description: `Invest resources to bring the network online. Receive ${EVENT_REWARD_CONFIG.conduitRelayGold} gold in contractor fees as the relay goes live.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.conduitRelayGold,
          livesDelta: 0,
          description: 'The relay hums to life. The gold transfer clears before the signal does.',
        },
      },
      {
        label: 'Sabotage the enemy node',
        description: `Spend ${EVENT_REWARD_CONFIG.conduitRelaySabotageGoldCost} gold on suppressor charges. Deny the network to both sides.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.conduitRelaySabotageGoldCost,
          livesDelta: 0,
          relicId: RelicId.QUICK_DRAW,
          description: 'A clean denial. The Quick Draw module salvaged from the wreckage is a fair trade.',
        },
      },
    ],
  },

  // ── Item economy events ────────────────────────────────────────────────────

  {
    id: 'field_cache',
    title: 'Field Cache',
    description: 'A supply canister half-buried in mud. Standard forward-unit kit — medkits, smoke, a few odds and ends. The manifest is still attached.',
    choices: [
      {
        label: 'Take the Heal Potion',
        description: 'Pocket the field medkit for later use.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          itemReward: ItemType.HEAL_POTION,
          description: 'The medkit goes into your pack. Field medicine has saved worse situations.',
        },
      },
      {
        label: 'Sell the whole cache',
        description: `Sell the manifest and contents unsorted for ${EVENT_REWARD_CONFIG.fieldCacheGoldAlt} gold.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.fieldCacheGoldAlt,
          livesDelta: 0,
          description: 'The quartermaster pays without asking where it came from.',
        },
      },
    ],
  },
  {
    id: 'alchemist_trader',
    title: 'Alchemist on the Road',
    description: 'A wandering synthesist sets up shop under an overhang, alembics bubbling. They have one batch left and want coin, not barter.',
    choices: [
      {
        label: 'Buy a Greater Heal',
        description: `Spend ${EVENT_REWARD_CONFIG.alchemistGoldCost} gold on a premium restoration vial.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.alchemistGoldCost,
          livesDelta: 0,
          itemReward: ItemType.GREATER_HEAL,
          description: 'The vial is warm to the touch and tastes of copper. It will do its job when called on.',
        },
      },
      {
        label: 'Buy an Energy Elixir',
        description: `Spend ${EVENT_REWARD_CONFIG.alchemistGoldCost} gold on a combat-focused stimulant.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.alchemistGoldCost,
          livesDelta: 0,
          itemReward: ItemType.ENERGY_ELIXIR,
          description: 'The elixir fizzes. You will be glad it is in your pack when the next wave breaks.',
        },
      },
    ],
  },
  {
    id: 'sapper_offering',
    title: "Sapper's Surplus",
    description: 'A combat engineer is clearing out their kit before rotation. They have more ordnance than they are authorised to carry back. Everything is negotiable.',
    choices: [
      {
        label: 'Take the Bomb',
        description: 'Acquire a demolition charge. High-yield, single-use.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          itemReward: ItemType.BOMB,
          description: 'The charge is handed over with a laminated safety card that neither of you reads.',
        },
      },
      {
        label: 'Take the Caltrops',
        description: 'Acquire area-denial caltrops. Slower but persistent.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          itemReward: ItemType.CALTROPS,
          description: 'A pouch of steel stars. The sapper keeps the safety card.',
        },
      },
    ],
  },
  {
    id: 'vault_broker',
    title: 'Vault Broker',
    description: 'A contact you have never met slides a Vault Key across the table and names a price. Access to a forward cache — but access always costs something.',
    choices: [
      {
        label: 'Buy the key',
        description: `Pay ${EVENT_REWARD_CONFIG.vaultDealGold} gold and ${EVENT_REWARD_CONFIG.vaultDealLivesCost} lives — the job was not clean.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.vaultDealGold,
          livesDelta: -EVENT_REWARD_CONFIG.vaultDealLivesCost,
          itemReward: ItemType.VAULT_KEY,
          description: 'The key is yours. The cost was higher than advertised, but then it always is.',
        },
      },
      {
        label: 'Walk away',
        description: 'The deal smells wrong.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'Trust your instincts. You leave the key on the table.',
        },
      },
    ],
  },

  // ── Card economy events ────────────────────────────────────────────────────

  {
    id: 'paid_purge',
    title: 'Paid Purge',
    description: 'A specialist offers a clean excision — one card, gone permanently, in exchange for a fee. No questions, no record. Dead weight removed surgically.',
    choices: [
      {
        label: 'Pay for the purge',
        description: `Pay ${EVENT_REWARD_CONFIG.purifierPaidGold} gold. Remove one card from your deck.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.purifierPaidGold,
          livesDelta: 0,
          removeCard: true,
          description: 'The excision is clean. Your deck is leaner.',
        },
      },
      {
        label: 'Keep your full arsenal',
        description: 'Every card has its moment.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'You decline. Redundancy has its own value.',
        },
      },
    ],
  },
  {
    id: 'scavenger_exchange',
    title: 'Scavenger Exchange',
    description: 'A post-battle scavenger offers a trade — they take a card from your deck and pay you out of their recovery haul. They are not picky; you should be.',
    choices: [
      {
        label: 'Make the exchange',
        description: `Remove a card from your deck. Receive ${EVENT_REWARD_CONFIG.scavengerTradeGold} gold.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.scavengerTradeGold,
          livesDelta: 0,
          removeCard: true,
          description: 'The card changes hands. The gold follows. A fair trade by scavenger standards.',
        },
      },
      {
        label: 'Nothing to trade',
        description: 'Your deck is exactly what you need.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The scavenger shrugs and moves on to a more willing seller.',
        },
      },
    ],
  },
  {
    id: 'arsenal_triage',
    title: 'Arsenal Triage',
    description: 'Command orders a mandatory loadout review. You can surrender a card now and receive operational credit — or push back, spend resources arguing the point, and keep everything.',
    choices: [
      {
        label: 'Comply and trim',
        description: `Remove a card. Receive ${EVENT_REWARD_CONFIG.arsenalAuditGold} gold in operational credit.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.arsenalAuditGold,
          livesDelta: 0,
          removeCard: true,
          description: 'You file the paperwork. Command approves the disbursement without reading what you surrendered.',
        },
      },
      {
        label: 'Contest the order',
        description: `Spend ${EVENT_REWARD_CONFIG.triageChoiceGoldCost} gold on legal review. Keep the card, gain ${EVENT_REWARD_CONFIG.triageChoiceLivesDelta} lives from the morale boost of winning.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.triageChoiceGoldCost,
          livesDelta: EVENT_REWARD_CONFIG.triageChoiceLivesDelta,
          description: 'The appeal is sustained. Your unit celebrates. Your accounts do not.',
        },
      },
    ],
  },

  // ── Gamble events ──────────────────────────────────────────────────────────

  {
    id: 'ordnance_wager',
    title: 'Ordnance Wager',
    description: 'Two munitions runners bet on the outcome of the next sortie. The stakes are real. You can buy in at long odds — or pass.',
    choices: [
      {
        label: 'Bet at 35% odds',
        // EV: 0.35 × 100 + 0.65 × 0 = 35 gold expected
        description: `35% chance to win ${EVENT_REWARD_CONFIG.ordnanceBetHighWin} gold. High-risk, high-return.`,
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The dice roll.',
          gamble: {
            winGoldDelta: EVENT_REWARD_CONFIG.ordnanceBetHighWin,
            loseGoldDelta: EVENT_REWARD_CONFIG.ordnanceBetHighLose,
            winChance: EVENT_REWARD_CONFIG.ordnanceBetHighChance,
          },
        },
      },
      {
        label: 'Stay out of it',
        description: 'Watching others gamble is its own entertainment.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'You pocket your hands and watch. The bet is settled without you.',
        },
      },
    ],
  },
  {
    id: 'binary_choice',
    title: 'Binary Choice',
    description: 'An automated checkpoint terminal offers a challenge: a sequence lock with two valid solutions. One awards a payout; the other locks your account. The terminal does not say which is which.',
    choices: [
      {
        label: 'Attempt the sequence',
        // EV: 0.45 × 120 + 0.55 × (−30) = 54 − 16.5 = 37.5 gold expected
        description: `45% chance to gain ${EVENT_REWARD_CONFIG.binaryChoiceWinGold} gold. Failure costs ${Math.abs(EVENT_REWARD_CONFIG.binaryChoiceLoseGold)} gold.`,
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'You key in the sequence.',
          gamble: {
            winGoldDelta: EVENT_REWARD_CONFIG.binaryChoiceWinGold,
            loseGoldDelta: EVENT_REWARD_CONFIG.binaryChoiceLoseGold,
            winChance: EVENT_REWARD_CONFIG.binaryChoiceWinChance,
          },
        },
      },
      {
        label: 'Leave it alone',
        description: 'Terminal traps are a classic for a reason.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The terminal times out and locks itself. Probably for the best.',
        },
      },
    ],
  },
  {
    id: 'fortune_wheel',
    title: 'Fortune Wheel',
    description: 'A maintenance bot has been reprogrammed into a lottery terminal. It accepts bets in gold. The odds are marginally in your favour, which is the only honest lottery you have ever seen.',
    choices: [
      {
        label: 'Spin',
        // EV: 0.55 × 60 + 0.45 × (−20) = 33 − 9 = 24 gold expected
        description: `55% chance to gain ${EVENT_REWARD_CONFIG.fortuneWheelWinGold} gold. Failure costs ${Math.abs(EVENT_REWARD_CONFIG.fortuneWheelLoseGold)} gold.`,
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'The wheel spins.',
          gamble: {
            winGoldDelta: EVENT_REWARD_CONFIG.fortuneWheelWinGold,
            loseGoldDelta: EVENT_REWARD_CONFIG.fortuneWheelLoseGold,
            winChance: EVENT_REWARD_CONFIG.fortuneWheelWinChance,
          },
        },
      },
      {
        label: 'Ignore the machine',
        description: 'You have seen what happens to soldiers who trust reprogrammed bots.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'Wisdom. The bot plays against itself and wins.',
        },
      },
    ],
  },
  {
    id: 'field_wager',
    title: 'Field Wager',
    description: 'A recon team bets on the next patrol outcome. They cut you in if you contribute upfront — a modest lives tithe for a larger return, assuming the patrol succeeds.',
    choices: [
      {
        label: 'Put in the stakes',
        description: `Lose ${EVENT_REWARD_CONFIG.riskWagerLoseLives} lives now. ${Math.round(EVENT_REWARD_CONFIG.riskWagerWinChance * 100)}% chance the patrol holds — gain ${EVENT_REWARD_CONFIG.riskWagerWinLives} lives plus your stake back. Otherwise: the lives are gone.`,
        outcome: {
          goldDelta: 0,
          livesDelta: -EVENT_REWARD_CONFIG.riskWagerLoseLives,
          description: 'The patrol outcome is decided.',
          gamble: {
            winGoldDelta: 0,
            loseGoldDelta: 0,
            winChance: EVENT_REWARD_CONFIG.riskWagerWinChance,
            winLivesDelta: EVENT_REWARD_CONFIG.riskWagerWinLives + EVENT_REWARD_CONFIG.riskWagerLoseLives,
            loseLivesDelta: 0,
          },
        } satisfies EventOutcome,
      },
      {
        label: 'Stay out',
        description: 'Morale is too important to bet.',
        outcome: {
          goldDelta: 0,
          livesDelta: 0,
          description: 'You decline. The unit respects the discipline.',
        },
      },
    ],
  },

  // ── Lives/gold tension events ──────────────────────────────────────────────

  {
    id: 'war_shrine',
    title: 'War Shrine',
    description: 'Soldiers have built a field shrine from salvaged metal and battle debris. The candles are lit. The offerings bowl is full. There is room for yours.',
    choices: [
      {
        label: 'Make an offering',
        description: `Donate ${EVENT_REWARD_CONFIG.warShrineDonationGold} gold. Restore ${EVENT_REWARD_CONFIG.warShrineHealLives} lives.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.warShrineDonationGold,
          livesDelta: EVENT_REWARD_CONFIG.warShrineHealLives,
          description: 'The candles flare briefly. The weight on your shoulders lightens.',
        },
      },
      {
        label: 'Take from the bowl',
        description: 'The dead have no use for coin. You do.',
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.warShrineDonationGold,
          livesDelta: -1,
          description: 'The coin is yours. The shrine goes dark. Something behind your eyes aches.',
        },
      },
    ],
  },
  {
    id: 'checkpoint_toll',
    title: 'Checkpoint Toll',
    description: 'A makeshift checkpoint blocks the road. The guards are not hostile — they are just expensive. There is another route. It takes longer and costs blood, not coin.',
    choices: [
      {
        label: 'Pay the toll',
        description: `Spend ${EVENT_REWARD_CONFIG.tollCostGold} gold. Passage guaranteed.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.tollCostGold,
          livesDelta: 0,
          description: 'The barrier lifts. Clean, efficient, overpriced.',
        },
      },
      {
        label: 'Take the long route',
        description: `Lose ${EVENT_REWARD_CONFIG.tollBypassLivesCost} life to enemy contact on the alternate path.`,
        outcome: {
          goldDelta: 0,
          livesDelta: -EVENT_REWARD_CONFIG.tollBypassLivesCost,
          description: 'The alternate route is shorter than it looked on the map. Unfortunately so was the ambush.',
        },
      },
    ],
  },
  {
    id: 'ambush_survivor',
    title: 'Ambush Survivor',
    description: 'A soldier staggers out of the brush, gear shredded, clutching a salvage bag. They were the only one out of a four-person patrol. They are sharing everything they recovered.',
    choices: [
      {
        label: 'Accept the salvage',
        description: `Gain ${EVENT_REWARD_CONFIG.ambushSurvivorGold} gold from the recovered gear — but take ${EVENT_REWARD_CONFIG.ambushSurvivorLivesCost} lives from the weight of what they went through together.`,
        outcome: {
          goldDelta: EVENT_REWARD_CONFIG.ambushSurvivorGold,
          livesDelta: -EVENT_REWARD_CONFIG.ambushSurvivorLivesCost,
          description: 'The salvage is real. So is the guilt.',
        },
      },
      {
        label: 'Refuse the salvage',
        description: 'Let them keep it. Some debts do not go on the ledger.',
        outcome: {
          goldDelta: 0,
          livesDelta: 1,
          description: 'You wave it off. The soldier nods, something resolving in their face. You feel the better for it.',
        },
      },
    ],
  },
  {
    id: 'field_doctor',
    title: 'Field Doctor',
    description: 'A combat medic has set up a forward triage station. Full restoration is on the table — but medical-grade supplies are not free, and neither is expertise.',
    choices: [
      {
        label: 'Full treatment',
        description: `Spend ${EVENT_REWARD_CONFIG.refugeeDoctorGoldCost} gold. Restore ${EVENT_REWARD_CONFIG.refugeeDoctorLivesDelta} lives.`,
        outcome: {
          goldDelta: -EVENT_REWARD_CONFIG.refugeeDoctorGoldCost,
          livesDelta: EVENT_REWARD_CONFIG.refugeeDoctorLivesDelta,
          description: 'The medic works without comment. You leave in better condition than you arrived.',
        },
      },
      {
        label: 'Field dress only',
        description: 'You can manage with what you have.',
        outcome: {
          goldDelta: 0,
          livesDelta: 1,
          description: 'Basic dressings. It holds. The medic does not argue.',
        },
      },
    ],
  },
];

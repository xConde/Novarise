/**
 * Event definitions for Ascent Mode EVENT nodes.
 *
 * Each event presents a narrative choice with trade-off outcomes.
 * StS-faithful design: events are opportunities with risk, not free rewards.
 */

import { RunEvent } from '../models/encounter.model';
import { RelicId } from '../models/relic.model';

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
  {
    id: 'wandering_merchant',
    title: 'Wandering Merchant',
    description: 'A hooded figure offers a trade: power for a price.',
    choices: [
      {
        label: 'Pay 50 gold',
        description: 'The merchant offers a sturdy trinket.',
        outcome: { goldDelta: -50, livesDelta: 0, relicId: RelicId.FIELD_RATIONS, description: 'You receive Field Rations.' },
      },
      {
        label: 'Decline politely',
        description: 'Keep your gold. The merchant vanishes.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'The figure dissolves into mist.' },
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
  {
    id: 'cursed_idol',
    title: 'Cursed Idol',
    description: 'A dark statue pulses with energy. Its power is undeniable — and clearly dangerous.',
    choices: [
      {
        label: 'Touch the idol',
        description: 'Gain 100 gold but lose 3 lives.',
        outcome: { goldDelta: 100, livesDelta: -3, description: 'Power surges through you. It burns.' },
      },
      {
        label: 'Walk away',
        description: 'Some things are better left alone.',
        outcome: { goldDelta: 0, livesDelta: 0, description: 'Wisdom is its own reward.' },
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
        label: 'Gamble 40 gold',
        description: 'Win: gain 80 gold. Lose: gain nothing.',
        outcome: { goldDelta: 40, livesDelta: 0, description: 'Fortune smiles today.' },
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
];

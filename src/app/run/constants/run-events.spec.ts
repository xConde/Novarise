import { RUN_EVENTS } from './run-events';
import { FLAG_KEYS } from './flag-keys';
import { RunEvent } from '../models/encounter.model';
import { EVENT_REWARD_CONFIG } from './event-reward.constants';

const VALID_ARCHETYPES = new Set(['cartographer', 'highground', 'conduit']);
const TOTAL_EVENT_COUNT = 44;

describe('RUN_EVENTS', () => {

  // ── Structural invariants (apply to every event) ─────────────────────────

  it(`should define exactly ${TOTAL_EVENT_COUNT} events`, () => {
    // 22 original events + 22 new events (chains D/E, archetypes, item economy,
    // card economy, gambles, lives/gold tension)
    expect(RUN_EVENTS.length).toBe(TOTAL_EVENT_COUNT);
  });

  it('every event id should be non-empty and unique', () => {
    const ids = RUN_EVENTS.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).withContext('duplicate event ids detected').toBe(ids.length);
    for (const id of ids) {
      expect(id.length).withContext(`event id "${id}" must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('every event should have a non-empty title', () => {
    for (const e of RUN_EVENTS) {
      expect(e.title.length).withContext(`event "${e.id}" title`).toBeGreaterThan(0);
    }
  });

  it('every event should have a non-empty description', () => {
    for (const e of RUN_EVENTS) {
      expect(e.description.length).withContext(`event "${e.id}" description`).toBeGreaterThan(0);
    }
  });

  it('every event should have at least 2 choices', () => {
    for (const e of RUN_EVENTS) {
      expect(e.choices.length)
        .withContext(`event "${e.id}" must have at least 2 choices`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('every choice should have a non-empty label, description, and outcome description', () => {
    for (const e of RUN_EVENTS) {
      for (const c of e.choices) {
        expect(c.label.length).withContext(`event "${e.id}" choice label`).toBeGreaterThan(0);
        expect(c.description.length).withContext(`event "${e.id}" choice description`).toBeGreaterThan(0);
        expect(c.outcome.description.length).withContext(`event "${e.id}" outcome description`).toBeGreaterThan(0);
      }
    }
  });

  // ── Archetype gating ───────────────────────────────────────────────────────

  it('every requiresDominantArchetype value must be cartographer, highground, or conduit', () => {
    for (const e of RUN_EVENTS) {
      if (e.requiresDominantArchetype !== undefined) {
        expect(VALID_ARCHETYPES.has(e.requiresDominantArchetype))
          .withContext(`event "${e.id}" has invalid requiresDominantArchetype: "${e.requiresDominantArchetype}"`)
          .toBeTrue();
      }
    }
  });

  it('archetype-gated events should exist for cartographer, highground, and conduit', () => {
    const archetypesPresent = new Set(
      RUN_EVENTS
        .filter(e => e.requiresDominantArchetype !== undefined)
        .map(e => e.requiresDominantArchetype!),
    );
    expect(archetypesPresent.has('cartographer')).withContext('cartographer event missing').toBeTrue();
    expect(archetypesPresent.has('highground')).withContext('highground event missing').toBeTrue();
    expect(archetypesPresent.has('conduit')).withContext('conduit event missing').toBeTrue();
  });

  // ── Gamble invariants ─────────────────────────────────────────────────────

  it('all gamble winChance values must be in (0, 1) exclusive', () => {
    for (const e of RUN_EVENTS) {
      for (const c of e.choices) {
        if (c.outcome.gamble) {
          const wc = c.outcome.gamble.winChance;
          expect(wc).withContext(`event "${e.id}" gamble winChance must be > 0`).toBeGreaterThan(0);
          expect(wc).withContext(`event "${e.id}" gamble winChance must be < 1`).toBeLessThan(1);
        }
      }
    }
  });

  // ── Chain/flag invariants ─────────────────────────────────────────────────

  it('every requiresFlag references a key that some event setsFlag', () => {
    const setFlags = new Set<string>();
    for (const e of RUN_EVENTS) {
      for (const c of e.choices) {
        if (c.outcome.setsFlag) setFlags.add(c.outcome.setsFlag);
      }
    }
    for (const e of RUN_EVENTS) {
      if (e.requiresFlag !== undefined) {
        expect(setFlags.has(e.requiresFlag))
          .withContext(`event "${e.id}" requiresFlag "${e.requiresFlag}" is never set by any event`)
          .toBeTrue();
      }
    }
  });

  it('every requiresFlag and requiresFlagAbsent value must be a known FLAG_KEYS value', () => {
    const knownFlags = new Set<string>(Object.values(FLAG_KEYS));
    for (const e of RUN_EVENTS) {
      if (e.requiresFlag !== undefined) {
        expect(knownFlags.has(e.requiresFlag))
          .withContext(`event "${e.id}" requiresFlag "${e.requiresFlag}" is not in FLAG_KEYS`)
          .toBeTrue();
      }
      if (e.requiresFlagAbsent !== undefined) {
        expect(knownFlags.has(e.requiresFlagAbsent))
          .withContext(`event "${e.id}" requiresFlagAbsent "${e.requiresFlagAbsent}" is not in FLAG_KEYS`)
          .toBeTrue();
      }
    }
  });

  it('every setsFlag value in outcomes must be a known FLAG_KEYS value', () => {
    const knownFlags = new Set<string>(Object.values(FLAG_KEYS));
    for (const e of RUN_EVENTS) {
      for (const c of e.choices) {
        if (c.outcome.setsFlag !== undefined) {
          expect(knownFlags.has(c.outcome.setsFlag))
            .withContext(`event "${e.id}" setsFlag "${c.outcome.setsFlag}" is not in FLAG_KEYS`)
            .toBeTrue();
        }
      }
    }
  });

  it('every part-2 chain event (requiresFlag set) must have firesOncePerRun: true', () => {
    for (const e of RUN_EVENTS) {
      if (e.requiresFlag !== undefined) {
        expect(e.firesOncePerRun)
          .withContext(`event "${e.id}" is a chain part-2 and must have firesOncePerRun: true`)
          .toBeTrue();
      }
    }
  });

  // ── Chain pairing ─────────────────────────────────────────────────────────

  it('each FLAG_KEY used in requiresFlag must also appear in some requiresFlagAbsent', () => {
    const requireFlags = new Set<string>();
    const absentFlags = new Set<string>();
    for (const e of RUN_EVENTS) {
      if (e.requiresFlag) requireFlags.add(e.requiresFlag);
      if (e.requiresFlagAbsent) absentFlags.add(e.requiresFlagAbsent);
    }
    for (const flag of requireFlags) {
      expect(absentFlags.has(flag))
        .withContext(`flag "${flag}" used in requiresFlag but no part-1 uses requiresFlagAbsent for it`)
        .toBeTrue();
    }
  });

  // ── Known event existence checks ──────────────────────────────────────────

  it('should include all 5 chain events from the original 19', () => {
    const chainIds = [
      'wandering_merchant_intro', 'wandering_merchant_return',
      'cursed_idol_offer', 'cursed_idol_reckoning',
      'injured_scout_encounter', 'scout_returns_grateful',
    ];
    for (const id of chainIds) {
      expect(RUN_EVENTS.some(e => e.id === id))
        .withContext(`original chain event "${id}" missing`)
        .toBeTrue();
    }
  });

  it('should include the 4 new chain events (D and E)', () => {
    const newChainIds = [
      'deserter_encounter', 'deserter_returns',
      'strange_signal', 'signal_source_found',
    ];
    for (const id of newChainIds) {
      expect(RUN_EVENTS.some(e => e.id === id))
        .withContext(`new chain event "${id}" missing`)
        .toBeTrue();
    }
  });

  it('should include 3 archetype-gated events', () => {
    const archetypeEvents = RUN_EVENTS.filter(e => e.requiresDominantArchetype !== undefined);
    expect(archetypeEvents.length).toBe(3);
  });

  // ── field_wager — lives gamble contract ───────────────────────────────────

  describe('field_wager event', () => {
    let fieldWager: RunEvent | undefined;

    beforeEach(() => {
      fieldWager = RUN_EVENTS.find(e => e.id === 'field_wager');
    });

    it('exists in RUN_EVENTS', () => {
      expect(fieldWager).toBeDefined();
    });

    it('wager choice has upfront lives cost via livesDelta', () => {
      const wagerChoice = fieldWager!.choices[0];
      expect(wagerChoice.outcome.livesDelta).toBe(-EVENT_REWARD_CONFIG.riskWagerLoseLives);
    });

    it('wager choice has a gamble with riskWagerWinChance', () => {
      const wagerChoice = fieldWager!.choices[0];
      expect(wagerChoice.outcome.gamble).toBeDefined();
      expect(wagerChoice.outcome.gamble!.winChance).toBe(EVENT_REWARD_CONFIG.riskWagerWinChance);
    });

    it('wager gamble carries winLivesDelta equal to riskWagerWinLives + riskWagerLoseLives', () => {
      const wagerChoice = fieldWager!.choices[0];
      const extGamble = wagerChoice.outcome.gamble as { winLivesDelta?: number };
      expect(extGamble.winLivesDelta)
        .toBe(EVENT_REWARD_CONFIG.riskWagerWinLives + EVENT_REWARD_CONFIG.riskWagerLoseLives);
    });

    it('wager gamble carries loseLivesDelta of 0 (upfront cost is the loss)', () => {
      const wagerChoice = fieldWager!.choices[0];
      const extGamble = wagerChoice.outcome.gamble as { loseLivesDelta?: number };
      expect(extGamble.loseLivesDelta ?? 0).toBe(0);
    });

    it('stay-out choice has no cost and no gamble', () => {
      const stayOut = fieldWager!.choices[1];
      expect(stayOut.outcome.livesDelta).toBe(0);
      expect(stayOut.outcome.goldDelta).toBe(0);
      expect(stayOut.outcome.gamble).toBeUndefined();
    });
  });
});

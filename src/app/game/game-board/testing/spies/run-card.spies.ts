import { BehaviorSubject } from 'rxjs';

import { RunService } from '../../../../run/services/run.service';
import { DeckService } from '../../../../run/services/deck.service';
import { CardEffectService } from '../../../../run/services/card-effect.service';
import { RelicService } from '../../../../run/services/relic.service';
import { DECK_CONFIG, DeckState, EnergyState } from '../../../../run/models/card.model';

export function createRunServiceSpy(): jasmine.SpyObj<RunService> {
  const spy = jasmine.createSpyObj('RunService', [
    'isInRun', 'hasActiveRun', 'getCurrentEncounter', 'recordEncounterResult',
    'startNewRun', 'resumeRun', 'abandonRun', 'selectNode', 'prepareEncounter',
    'getRngState', 'restoreRngState',
  ], ['runState']);

  // Post-pivot default: there is ALWAYS an active run. Combat cannot happen
  // outside a run encounter, so GameBoardComponent tests assume a happy-path
  // run/encounter exists. Tests that specifically exercise "no run" paths
  // should override isInRun / runState / getCurrentEncounter individually.
  spy.isInRun.and.returnValue(true);
  spy.hasActiveRun.and.returnValue(true);
  spy.getCurrentEncounter.and.returnValue({
    nodeId: 'test-node',
    nodeType: 'combat',
    waves: [],
    enemyHealthMultiplier: 1,
    enemySpeedMultiplier: 1,
    goldMultiplier: 1,
  } as any);
  (Object.getOwnPropertyDescriptor(spy, 'runState')!.get as jasmine.Spy).and.returnValue({
    id: 'test-run',
    seed: 0,
    ascensionLevel: 0,
    lives: 7,
    maxLives: 7,
    gold: 0,
    relicIds: [],
    deckCardIds: [],
    encounterResults: [],
    status: 'in_progress',
    score: 0,
  } as any);

  return spy;
}

/**
 * Create a pre-configured DeckService spy for use in GameBoardComponent tests.
 *
 * Default return values:
 *   - deckState$ — Observable of an empty DeckState
 *   - energy$ — Observable of { current: 0, max: DECK_CONFIG.baseEnergy }
 *   - playCard() — true (success)
 *   - drawOne() — true (success)
 *   - All other methods — no-op void or safe defaults
 */
export function createDeckServiceSpy(): jasmine.SpyObj<DeckService> {
  const emptyDeckState: DeckState = {
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
  };
  const emptyEnergy: EnergyState = { current: 0, max: DECK_CONFIG.baseEnergy };

  const deckState$ = new BehaviorSubject<DeckState>(emptyDeckState);
  const energy$ = new BehaviorSubject<EnergyState>(emptyEnergy);

  const spy = jasmine.createSpyObj<DeckService>('DeckService', [
    'initializeDeck',
    'resetForEncounter',
    'drawForWave',
    'discardHand',
    'playCard',
    'drawOne',
    'drawCards',
    'addCard',
    'removeCard',
    'upgradeCard',
    'getAllCards',
    'getEnergy',
    'getDeckState',
    'setMaxEnergy',
    'addEnergy',
    'clear',
    'getRngState',
    'setRngState',
    'restoreState',
    'serializeState',
  ]);

  // DeckService exposes deckState$ and energy$ as readonly Observables.
  // We assign observables directly using type bypass.
  (spy as unknown as { deckState$: ReturnType<typeof deckState$.asObservable> }).deckState$ = deckState$.asObservable();
  (spy as unknown as { energy$: ReturnType<typeof energy$.asObservable> }).energy$ = energy$.asObservable();

  spy.playCard.and.returnValue(true);
  spy.drawOne.and.returnValue(true);
  spy.removeCard.and.returnValue(true);
  spy.upgradeCard.and.returnValue(true);
  spy.getAllCards.and.returnValue([]);
  spy.getEnergy.and.returnValue(emptyEnergy);
  spy.getDeckState.and.returnValue(emptyDeckState);

  return spy;
}

/**
 * Create a pre-configured CardEffectService spy.
 *
 * Default return values:
 *   - getModifierValue() — 0 (no active modifiers)
 *   - hasActiveModifier() — false
 *   - getActiveModifiers() — empty readonly array
 *   - applySpell / applyModifier / tickWave / tickTurn / reset — no-op void
 */
export function createCardEffectServiceSpy(): jasmine.SpyObj<CardEffectService> {
  const spy = jasmine.createSpyObj<CardEffectService>('CardEffectService', [
    'applySpell',
    'applyModifier',
    'tickWave',
    'tickTurn',
    'getModifierValue',
    'getMaxModifierEntryValue',
    'hasActiveModifier',
    'getActiveModifiers',
    'tryConsumeLeakBlock',
    'tryConsumeTerraformRefund',
    'reset',
  ]);
  spy.getModifierValue.and.returnValue(0);
  spy.getMaxModifierEntryValue.and.returnValue(0);
  spy.hasActiveModifier.and.returnValue(false);
  spy.getActiveModifiers.and.returnValue([]);
  spy.tryConsumeLeakBlock.and.returnValue(false);
  spy.tryConsumeTerraformRefund.and.returnValue(false);
  return spy;
}

export function createRelicServiceSpy(): jasmine.SpyObj<RelicService> {
  const spy = jasmine.createSpyObj('RelicService', [
    'setActiveRelics', 'clearRelics', 'resetEncounterState', 'resetWaveState',
    'hasRelic', 'getModifiers', 'getDamageMultiplier',
    'getRangeMultiplier', 'getTowerCostMultiplier', 'getUpgradeCostMultiplier',
    'getSellRefundRate', 'getGoldMultiplier', 'getEnemySpeedMultiplier',
    'getMaxLivesBonus', 'getStartingGoldBonus',
    'getSplashRadiusMultiplier', 'getChainBounceBonus',
    'getDotDamageMultiplier', 'isNextTowerFree', 'consumeFreeTower',
    'shouldBlockLeak', 'rollLuckyCoin', 'getAvailableRelics',
    'hasQuickDraw', 'getSlowDurationBonus', 'getTurnDelayPerWave',
    'recordTileVisited', 'consumeSurveyorGold', 'getCardEnergyCostModifier',
    'incrementOrogenyCounter', 'getOrogenyTurnCounter', 'isOrogenyTrigger',
    'hasSurveyorRod', 'serializeEncounterFlags', 'restoreEncounterFlags',
    'hasTuningFork', 'hasConstellation',
  ], ['relicCount']);

  spy.getDamageMultiplier.and.returnValue(1);
  spy.getRangeMultiplier.and.returnValue(1);
  spy.getTowerCostMultiplier.and.returnValue(1);
  spy.getUpgradeCostMultiplier.and.returnValue(1);
  spy.getSellRefundRate.and.returnValue(0.5);
  spy.getGoldMultiplier.and.returnValue(1);
  spy.getEnemySpeedMultiplier.and.returnValue(1);
  spy.getMaxLivesBonus.and.returnValue(0);
  spy.getStartingGoldBonus.and.returnValue(0);
  spy.getSplashRadiusMultiplier.and.returnValue(1);
  spy.getChainBounceBonus.and.returnValue(0);
  spy.getDotDamageMultiplier.and.returnValue(1);
  spy.hasQuickDraw.and.returnValue(false);
  spy.getSlowDurationBonus.and.returnValue(0);
  spy.getTurnDelayPerWave.and.returnValue(0);
  spy.isNextTowerFree.and.returnValue(false);
  spy.shouldBlockLeak.and.returnValue(false);
  spy.rollLuckyCoin.and.returnValue(1);
  spy.getAvailableRelics.and.returnValue([]);
  spy.consumeSurveyorGold.and.returnValue(0);
  spy.getCardEnergyCostModifier.and.returnValue(0);
  spy.incrementOrogenyCounter.and.returnValue(0);
  spy.getOrogenyTurnCounter.and.returnValue(0);
  spy.isOrogenyTrigger.and.returnValue(false);
  spy.hasSurveyorRod.and.returnValue(false);
  spy.hasTuningFork.and.returnValue(false);
  spy.hasConstellation.and.returnValue(false);
  (Object.getOwnPropertyDescriptor(spy, 'relicCount')!.get as jasmine.Spy).and.returnValue(0);

  return spy;
}

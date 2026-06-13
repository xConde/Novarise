import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';
import { ActiveModifier } from '../../../run/services/card-effect.service';
import { BuffChip, toBuffChips } from './buff-display.model';

function makeModifier(
  stat: ActiveModifier['stat'],
  value: number,
  remainingWaves: number | null = 2,
  remainingTurns?: number,
): ActiveModifier {
  return { stat, value, remainingWaves, remainingTurns };
}

describe('toBuffChips', () => {

  describe('label formatting', () => {
    it('formats percent stats as "+N%"', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.DAMAGE, 0.25)]);
      expect(chips.length).toBe(1);
      expect(chips[0].label).toBe('Damage +25%');
    });

    it('rounds percent values', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.RANGE, 0.333)]);
      expect(chips[0].label).toBe('Range +33%');
    });

    it('formats sniper damage as percent', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.SNIPER_DAMAGE, 0.5)]);
      expect(chips[0].label).toBe('Sniper Dmg +50%');
    });

    it('formats fire rate as percent', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.FIRE_RATE, 0.1)]);
      expect(chips[0].label).toBe('Fire Rate +10%');
    });

    it('formats chain bounces as flat', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.CHAIN_BOUNCES, 2)]);
      expect(chips[0].label).toBe('Chain +2');
    });

    it('formats gold multiplier as percent', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.GOLD_MULTIPLIER, 0.5)]);
      expect(chips[0].label).toBe('Gold Interest +50%');
    });

    it('formats enemy slow using absolute value', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.ENEMY_SPEED, -0.3)]);
      expect(chips[0].label).toBe('Enemy Slow 30%');
    });

    it('formats leak block label as name only (count goes in remaining)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LEAK_BLOCK, 3, null)]);
      expect(chips[0].label).toBe('Leak Shield');
    });
  });

  describe('remaining string', () => {
    it('shows wave countdown for wave-scoped modifiers', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.DAMAGE, 0.2, 3)]);
      expect(chips[0].remaining).toBe('3 waves');
    });

    it('uses singular "wave" for 1 remaining wave', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.DAMAGE, 0.2, 1)]);
      expect(chips[0].remaining).toBe('1 wave');
    });

    it('shows turn countdown for turn-scoped modifiers', () => {
      const mod = makeModifier(MODIFIER_STAT.FIRE_RATE, 0.2, null, 2);
      const chips = toBuffChips([mod]);
      expect(chips[0].remaining).toBe('2 turns');
    });

    it('uses singular "turn" for 1 remaining turn', () => {
      const mod = makeModifier(MODIFIER_STAT.FIRE_RATE, 0.2, null, 1);
      const chips = toBuffChips([mod]);
      expect(chips[0].remaining).toBe('1 turn');
    });

    it('shows "active" for encounter-scoped modifiers (null waves, no turns)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.GOLD_MULTIPLIER, 0.5, null)]);
      expect(chips[0].remaining).toBe('active');
    });

    it('shows block count for leak block with value > 0', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LEAK_BLOCK, 2, null)]);
      expect(chips[0].remaining).toBe('2 blocks');
    });

    it('uses singular "block" for 1 remaining block', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LEAK_BLOCK, 1, null)]);
      expect(chips[0].remaining).toBe('1 block');
    });
  });

  describe('charges skip-when-zero', () => {
    it('skips leak block chip when value is 0', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LEAK_BLOCK, 0, null)]);
      expect(chips.length).toBe(0);
    });

    it('skips leak block chip when value is negative', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LEAK_BLOCK, -1, null)]);
      expect(chips.length).toBe(0);
    });
  });

  describe('unmapped stats are excluded', () => {
    it('drops TERRAFORM_ANCHOR (archetype sentinel)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null)]);
      expect(chips.length).toBe(0);
    });

    it('drops LABYRINTH_MIND (archetype sentinel)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.LABYRINTH_MIND, 1, null)]);
      expect(chips.length).toBe(0);
    });

    it('drops HANDSHAKE_DAMAGE_BONUS (Conduit sentinel)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS, 0.2, 2)]);
      expect(chips.length).toBe(0);
    });

    it('drops HIVE_MIND_CLUSTER_MAX (Conduit sentinel)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX, 1, null)]);
      expect(chips.length).toBe(0);
    });

    it('drops GRAVITY_WELL (archetype sentinel)', () => {
      const chips = toBuffChips([makeModifier(MODIFIER_STAT.GRAVITY_WELL, 1, null)]);
      expect(chips.length).toBe(0);
    });
  });

  describe('mixed input', () => {
    it('returns only mapped modifiers when mixed with sentinel stats', () => {
      const modifiers: ActiveModifier[] = [
        makeModifier(MODIFIER_STAT.DAMAGE, 0.25, 3),
        makeModifier(MODIFIER_STAT.TERRAFORM_ANCHOR, 1, null),
        makeModifier(MODIFIER_STAT.RANGE, 0.2, 2),
      ];
      const chips = toBuffChips(modifiers);
      expect(chips.length).toBe(2);
      expect(chips.map((c: BuffChip) => c.stat)).toEqual([
        MODIFIER_STAT.DAMAGE,
        MODIFIER_STAT.RANGE,
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(toBuffChips([])).toEqual([]);
    });
  });
});

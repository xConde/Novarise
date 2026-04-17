/**
 * Numeric constants for chained-event outcomes.
 * Keep all gold / life values here — no magic numbers in event definitions.
 */
export const EVENT_REWARD_CONFIG = {
  // Chain A: Wandering Merchant
  /** Gold granted when the player helps the wandering merchant. */
  merchantAidGold: 30,
  /** Gold granted when the merchant returns the favour (discounted deal). */
  merchantReturnGold: 60,

  // Chain B: Cursed Idol
  /** Gold gained from the idol bargain. */
  idolBargainGold: 50,
  /** Lives lost if the player chooses the lives penalty at reckoning. */
  idolReckoningLivesCost: 5,
  /** Gold lost if the player chooses the gold penalty at reckoning. */
  idolReckoningGoldCost: 30,

  // Chain C: Injured Scout
  /** Gold spent to help the injured scout. */
  scoutHelpGoldCost: 20,
  /** Gold reward when the grateful scout returns. */
  scoutGratefulGold: 60,
} as const;

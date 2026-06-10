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

  // Chain D: Deserter
  /** Gold paid to the deserter to buy their silence. */
  deserterBribeGold: 40,
  /** Gold received when the deserter returns the favour. */
  deserterAllyGold: 70,
  /** Lives lost if the deserter turns hostile on refusal. */
  deserterBetrayalLivesCost: 3,

  // Chain E: Strange Signal
  /** Gold spent to follow the strange signal's coordinates. */
  signalFollowGoldCost: 30,
  /** Gold gained when the signal source cache is recovered. */
  signalPayoffGold: 80,
  /** Lives restored from field medkits inside the signal cache. */
  signalPayoffLivesDelta: 2,

  // Archetype events
  /** Gold gained from selling corrected survey data (Cartographer event). */
  cartographerSurveyGold: 45,
  /** Lives restored from securing the elevated outpost (Highground event). */
  highgroundOutpostLivesDelta: 3,
  /** Gold spent to reinforce the elevated outpost (Highground event). */
  highgroundOutpostGoldCost: 25,
  /** Gold gained from restoring the relay network (Conduit event). */
  conduitRelayGold: 50,
  /** Gold spent to sabotage the enemy node (Conduit event). */
  conduitRelaySabotageGoldCost: 20,

  // Item economy events
  /** Gold gained from selling the whole field cache. */
  fieldCacheGoldAlt: 40,
  /** Gold cost for purchasing from the alchemist trader. */
  alchemistGoldCost: 35,
  /** Gold gained from the sapper's free surplus trade. */
  sapperChoiceGold: 30,
  /** Gold paid for the vault broker's key. */
  vaultDealGold: 55,
  /** Lives cost from the messy vault key acquisition. */
  vaultDealLivesCost: 2,

  // Card economy events
  /** Gold paid for the paid purge service. */
  purifierPaidGold: 20,
  /** Gold received from the scavenger's card exchange. */
  scavengerTradeGold: 30,
  /** Gold received as operational credit from the arsenal audit. */
  arsenalAuditGold: 45,
  /** Gold spent contesting the arsenal triage order. */
  triageChoiceGoldCost: 40,
  /** Lives gained from winning the triage appeal (morale boost). */
  triageChoiceLivesDelta: 4,

  // Gamble events
  /** Gold won on the high-risk ordnance wager. */
  ordnanceBetHighWin: 100,
  /** Gold outcome on the losing ordnance wager. */
  ordnanceBetHighLose: 0,
  /** Win probability for the ordnance wager. */
  ordnanceBetHighChance: 0.35,
  /** Gold gained on a winning binary choice attempt. */
  binaryChoiceWinGold: 120,
  /** Gold lost on a failing binary choice attempt. */
  binaryChoiceLoseGold: -30,
  /** Win probability for the binary choice terminal. */
  binaryChoiceWinChance: 0.45,
  /** Gold gained when the fortune wheel lands in your favour. */
  fortuneWheelWinGold: 60,
  /** Gold lost when the fortune wheel lands against you. */
  fortuneWheelLoseGold: -20,
  /** Win probability for the fortune wheel spin. */
  fortuneWheelWinChance: 0.55,
  /** Lives gained from a winning field wager. */
  riskWagerWinLives: 3,
  /** Lives risked on the losing side of a field wager. */
  riskWagerLoseLives: 2,
  /** Win probability for the field wager. */
  riskWagerWinChance: 0.6,

  // Lives/gold tension events
  /** Gold donated to the war shrine for healing. */
  warShrineDonationGold: 50,
  /** Lives restored by donating to the war shrine. */
  warShrineHealLives: 5,
  /** Gold paid at the checkpoint toll. */
  tollCostGold: 30,
  /** Lives lost taking the alternate route past the toll. */
  tollBypassLivesCost: 1,
  /** Gold gained from the ambush survivor's salvage. */
  ambushSurvivorGold: 65,
  /** Lives lost from sharing the weight of the ambush survivor's loss. */
  ambushSurvivorLivesCost: 2,
  /** Gold paid for full field doctor treatment. */
  refugeeDoctorGoldCost: 45,
  /** Lives restored by the field doctor's full treatment. */
  refugeeDoctorLivesDelta: 6,
} as const;

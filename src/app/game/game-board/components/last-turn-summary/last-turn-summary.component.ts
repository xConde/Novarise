import { Component, Input } from '@angular/core';

export interface TurnSummary {
  turnNumber: number;
  cardsPlayed: number;
  kills: number;
  goldEarned: number;
  livesLost: number;
}

@Component({
  selector: 'app-last-turn-summary',
  templateUrl: './last-turn-summary.component.html',
  styleUrls: ['./last-turn-summary.component.scss'],
})
export class LastTurnSummaryComponent {
  @Input() summary: TurnSummary | null = null;
  @Input() visible = false;
}

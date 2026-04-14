import { Component, Input } from '@angular/core';
import { TurnEventRecord } from '../../services/turn-history.service';

// TurnSummary kept as a re-export alias so existing imports compile without change.
export type TurnSummary = TurnEventRecord;

@Component({
  selector: 'app-last-turn-summary',
  templateUrl: './last-turn-summary.component.html',
  styleUrls: ['./last-turn-summary.component.scss'],
})
export class LastTurnSummaryComponent {
  @Input() summary: TurnEventRecord | null = null;
  @Input() visible = false;
}

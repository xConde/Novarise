import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-game-hud',
  templateUrl: './game-hud.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameHudComponent {
  @Input() lives = 0;
  @Input() gold = 0;
  @Input() wave = 0;
  @Input() maxWaves = 0;
  @Input() score = 0;
  @Input() formattedTime = '00:00';
  @Input() isEndless = false;
  @Input() isCampaignGame = false;
  @Input() levelName = '';
  @Input() speedRunTimeLimit = 0;
  @Input() elapsedTime = 0;

  get speedRunRemaining(): number {
    return Math.max(0, this.speedRunTimeLimit - this.elapsedTime);
  }

  get speedRunWarning(): boolean {
    return this.speedRunTimeLimit > 0 && this.speedRunRemaining <= 30;
  }

  get speedRunCritical(): boolean {
    return this.speedRunTimeLimit > 0 && this.speedRunRemaining <= 10;
  }

  get formattedSpeedRunRemaining(): string {
    const total = Math.ceil(this.speedRunRemaining);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
}

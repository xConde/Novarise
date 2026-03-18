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
}

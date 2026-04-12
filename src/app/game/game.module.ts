import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameBoardService } from './game-board/game-board.service';
import { CombatVFXService } from './game-board/services/combat-vfx.service';
import { TutorialSpotlightComponent } from './game-board/components/tutorial-spotlight/tutorial-spotlight.component';
import { GameHudComponent } from './game-board/components/game-hud/game-hud.component';
import { GameSetupPanelComponent } from './game-board/components/game-setup-panel/game-setup-panel.component';
import { TowerInfoPanelComponent } from './game-board/components/tower-info-panel/tower-info-panel.component';
import { GamePauseService } from './game-board/services/game-pause.service';
import { ChallengeDisplayService } from './game-board/services/challenge-display.service';
import { CardHandComponent } from './game-board/components/card-hand/card-hand.component';
@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent,
    TutorialSpotlightComponent,
    GameHudComponent,
    GameSetupPanelComponent,
    TowerInfoPanelComponent,
    CardHandComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService, CombatVFXService, GamePauseService, ChallengeDisplayService]
})
export class GameModule {}

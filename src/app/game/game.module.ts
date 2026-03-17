import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameBoardService } from './game-board/game-board.service';
import { CombatVFXService } from './game-board/services/combat-vfx.service';
import { TutorialSpotlightComponent } from './game-board/components/tutorial-spotlight/tutorial-spotlight.component';
@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent,
    TutorialSpotlightComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService, CombatVFXService]
})
export class GameModule {}

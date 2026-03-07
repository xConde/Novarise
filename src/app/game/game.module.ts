import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameBoardService } from './game-board/game-board.service';
import { StatusEffectService } from './game-board/services/status-effect.service';

@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService, StatusEffectService]
})
export class GameModule {}

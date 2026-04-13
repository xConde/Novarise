import { Component, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { GameBoardComponent } from './game-board/game-board.component';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent {
  @ViewChild(GameBoardComponent) gameBoard?: GameBoardComponent;

  requestGuardDecision(): Observable<boolean> | boolean {
    return this.gameBoard?.requestGuardDecision() ?? true;
  }
}

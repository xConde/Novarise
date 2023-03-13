import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { GameBoardComponent } from './game/game-board/game-board.component';
import { GameBoardService } from './game/game-board/game-board.service';
import { GameComponent } from './game/game.component';

@NgModule({
  declarations: [
    AppComponent,
    GameComponent,
    GameBoardComponent
  ],
  imports: [
    BrowserModule,
  ],
  exports: [],
  providers: [GameBoardService],
  bootstrap: [AppComponent]
})
export class AppModule { }

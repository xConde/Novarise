import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NovariseComponent } from './games/novarise/novarise.component';
import { EditControlsComponent } from './games/novarise/features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './games/novarise/features/mobile-controls';
import { GameComponent } from './game/game.component';
import { GameBoardComponent } from './game/game-board/game-board.component';
import { GameBoardService } from './game/game-board/game-board.service';

@NgModule({
  declarations: [
    AppComponent,
    NovariseComponent,
    EditControlsComponent,
    GameComponent,
    GameBoardComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    MobileControlsModule,
    AppRoutingModule
  ],
  exports: [],
  providers: [GameBoardService],
  bootstrap: [AppComponent]
})
export class AppModule { }

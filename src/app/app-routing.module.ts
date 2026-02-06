import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NovariseComponent } from './games/novarise/novarise.component';
import { GameComponent } from './game/game.component';

const routes: Routes = [
  { path: '', redirectTo: '/edit', pathMatch: 'full' },
  { path: 'edit', component: NovariseComponent },
  { path: 'play', component: GameComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

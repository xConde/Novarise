import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/edit', pathMatch: 'full' },
  { path: 'edit', loadChildren: () => import('./games/novarise/editor.module').then(m => m.EditorModule) },
  { path: 'play', loadChildren: () => import('./game/game.module').then(m => m.GameModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/edit', pathMatch: 'full' },
  { path: 'edit', loadChildren: () => import('./games/novarise/editor.module').then(m => m.EditorModule) },
  { path: 'play', loadChildren: () => import('./game/game.module').then(m => m.GameModule) },
  { path: 'maps', loadChildren: () => import('./game/map-select/map-select.module').then(m => m.MapSelectModule) },
  { path: 'campaign', loadChildren: () => import('./game/campaign/campaign.module').then(m => m.CampaignModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

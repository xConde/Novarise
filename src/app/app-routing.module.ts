import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { gameGuard } from './game/guards/game.guard';
import { gameLeaveGuard } from './game/guards/game-leave.guard';

const routes: Routes = [
  { path: '', loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule) },
  { path: 'edit', loadChildren: () => import('./games/novarise/editor.module').then(m => m.EditorModule) },
  { path: 'play', loadChildren: () => import('./game/game.module').then(m => m.GameModule), canActivate: [gameGuard], canDeactivate: [gameLeaveGuard] },
  { path: 'maps', loadChildren: () => import('./game/map-select/map-select.module').then(m => m.MapSelectModule) },
  { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule) },
  { path: 'campaign', loadChildren: () => import('./campaign/campaign.module').then(m => m.CampaignModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

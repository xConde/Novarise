import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { gameLeaveGuard } from './game/guards/game-leave.guard';

// Phase 8 route collapse + H4 profile re-add. Five routes:
//   /       — landing / run hub (start / continue / editor)
//   /edit   — dev map-making
//   /play   — combat encounter view (child of run flow)
//   /run    — run hub (node map, shop, reward, rest, event, summary)
//   /profile — stats / achievements (demoted, no nav link, reached via Home button)
// Removed in Phase 8: /maps (map-select), /campaign (16-map flow).
const routes: Routes = [
  { path: '', loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule) },
  { path: 'edit', loadChildren: () => import('./games/novarise/editor.module').then(m => m.EditorModule) },
  { path: 'play', loadChildren: () => import('./game/game.module').then(m => m.GameModule), canDeactivate: [gameLeaveGuard] },
  { path: 'run', loadChildren: () => import('./run/run.module').then(m => m.RunModule) },
  { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule) },
  // Fallback — anything else routes to Home
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

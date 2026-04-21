import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { devLibraryGuard } from './core/guards/dev-library.guard';
// Routes:
//   /        — landing / run hub (start / continue / editor)
//   /edit    — dev map-making
//   /play    — combat encounter view (child of run flow)
//   /run     — run hub (node map, shop, reward, rest, event, summary)
//   /profile — stats / achievements (demoted, no nav link, reached via Home button)
//   /library — dev-only card inspector (gated by environment.enableDevTools)
const routes: Routes = [
  { path: '', loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule) },
  { path: 'edit', loadChildren: () => import('./games/novarise/editor.module').then(m => m.EditorModule) },
  { path: 'play', loadChildren: () => import('./game/game.module').then(m => m.GameModule) },
  { path: 'run', loadChildren: () => import('./run/run.module').then(m => m.RunModule) },
  { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule) },
  { path: 'settings', loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule) },
  {
    path: 'library',
    canActivate: [devLibraryGuard],
    loadChildren: () => import('./library/library.module').then(m => m.LibraryModule),
  },
  // Fallback — anything else routes to Home
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

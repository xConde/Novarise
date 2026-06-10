import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Full-screen fallback panel shown when WebGL is unavailable.
 *
 * Rendered by GameBoardComponent INSTEAD of the Three.js canvas when
 * `isWebglAvailable()` returns false at startup. No gameplay state is
 * initialised when this panel is shown.
 *
 * Standalone — import directly into any NgModule or standalone host.
 */
@Component({
  selector: 'app-webgl-fallback',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './webgl-fallback.component.html',
  styleUrls: ['./webgl-fallback.component.scss'],
})
export class WebglFallbackComponent {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AscentComponent } from './ascent.component';
import { NodeMapComponent } from './components/node-map/node-map.component';

@NgModule({
  declarations: [AscentComponent, NodeMapComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: AscentComponent }]),
  ],
})
export class AscentModule {}

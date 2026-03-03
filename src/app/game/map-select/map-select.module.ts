import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MapSelectComponent } from './map-select.component';

@NgModule({
  declarations: [MapSelectComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: MapSelectComponent }])
  ]
})
export class MapSelectModule {}

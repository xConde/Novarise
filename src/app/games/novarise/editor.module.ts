import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NovariseComponent } from './novarise.component';
import { EditControlsComponent } from './features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './features/mobile-controls';

@NgModule({
  declarations: [
    NovariseComponent,
    EditControlsComponent
  ],
  imports: [
    CommonModule,
    MobileControlsModule,
    RouterModule.forChild([{ path: '', component: NovariseComponent }])
  ]
})
export class EditorModule {}

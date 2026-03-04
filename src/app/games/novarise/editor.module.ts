import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NovariseComponent } from './novarise.component';
import { EditControlsComponent } from './features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './features/mobile-controls';
import { PathValidationService } from './core/path-validation.service';

@NgModule({
  declarations: [
    NovariseComponent,
    EditControlsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MobileControlsModule,
    RouterModule.forChild([{ path: '', component: NovariseComponent }])
  ],
  providers: [
    PathValidationService
  ]
})
export class EditorModule {}

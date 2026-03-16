import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NovariseComponent } from './novarise.component';
import { EditControlsComponent } from './features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './features/mobile-controls';
import { PathValidationService } from './core/path-validation.service';
import { EditorStateService } from './core/editor-state.service';
import { EditHistoryService } from './core/edit-history.service';
import { CameraControlService } from './core/camera-control.service';

@NgModule({
  declarations: [
    NovariseComponent,
    EditControlsComponent
  ],
  imports: [
    CommonModule,
    MobileControlsModule,
    RouterModule.forChild([{ path: '', component: NovariseComponent }])
  ],
  providers: [
    PathValidationService,
    EditorStateService,
    EditHistoryService,
    CameraControlService
  ]
})
export class EditorModule {}

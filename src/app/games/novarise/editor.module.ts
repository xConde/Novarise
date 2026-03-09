import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NovariseComponent } from './novarise.component';
import { EditControlsComponent } from './features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './features/mobile-controls';
import { PathValidationService } from './core/path-validation.service';
import { EditHistoryService } from './core/edit-history.service';
import { CameraControlService } from './core/camera-control.service';
import { EditorStateService } from './core/editor-state.service';

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
    EditHistoryService,
    CameraControlService,
    EditorStateService
  ]
})
export class EditorModule {}

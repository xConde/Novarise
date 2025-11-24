import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VirtualJoystickComponent } from './components/virtual-joystick/virtual-joystick.component';
import { TouchDetectionService } from './services/touch-detection.service';

@NgModule({
  declarations: [
    VirtualJoystickComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    VirtualJoystickComponent
  ],
  providers: [
    TouchDetectionService
  ]
})
export class MobileControlsModule {}

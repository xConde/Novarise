import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { NovariseComponent } from './games/novarise/novarise.component';
import { EditControlsComponent } from './games/novarise/features/ui-controls/edit-controls.component';
import { MobileControlsModule } from './games/novarise/features/mobile-controls';

@NgModule({
  declarations: [
    AppComponent,
    NovariseComponent,
    EditControlsComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    MobileControlsModule
  ],
  exports: [],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

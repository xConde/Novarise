import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { NovariseComponent } from './games/novarise/novarise.component';
import { EditControlsComponent } from './games/novarise/features/ui-controls/edit-controls.component';

@NgModule({
  declarations: [
    AppComponent,
    NovariseComponent,
    EditControlsComponent
  ],
  imports: [
    BrowserModule,
    CommonModule
  ],
  exports: [],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

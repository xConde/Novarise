import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@NgModule({
  declarations: [ProfileComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: ProfileComponent }]),
    IconComponent,
  ]
})
export class ProfileModule {}

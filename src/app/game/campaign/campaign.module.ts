import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CampaignComponent } from './campaign.component';

@NgModule({
  declarations: [CampaignComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: CampaignComponent }])
  ]
})
export class CampaignModule {}

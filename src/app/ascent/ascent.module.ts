import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AscentComponent } from './ascent.component';
import { NodeMapComponent } from './components/node-map/node-map.component';
import { RewardScreenComponent } from './components/reward-screen/reward-screen.component';
import { RestScreenComponent } from './components/rest-screen/rest-screen.component';
import { ShopScreenComponent } from './components/shop-screen/shop-screen.component';
import { EventScreenComponent } from './components/event-screen/event-screen.component';
import { RelicInventoryComponent } from './components/relic-inventory/relic-inventory.component';

@NgModule({
  declarations: [AscentComponent, NodeMapComponent, RewardScreenComponent, RestScreenComponent, ShopScreenComponent, EventScreenComponent, RelicInventoryComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: AscentComponent }]),
  ],
})
export class AscentModule {}

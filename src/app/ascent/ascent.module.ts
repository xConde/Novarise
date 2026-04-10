import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AscentComponent } from './ascent.component';
import { NodeMapComponent } from './components/node-map/node-map.component';
import { RewardScreenComponent } from './components/reward-screen/reward-screen.component';
import { RestScreenComponent } from './components/rest-screen/rest-screen.component';
import { ShopScreenComponent } from './components/shop-screen/shop-screen.component';
import { EventScreenComponent } from './components/event-screen/event-screen.component';
import { RelicInventoryComponent } from './components/relic-inventory/relic-inventory.component';
import { ActTransitionComponent } from './components/act-transition/act-transition.component';

@NgModule({
  declarations: [
    AscentComponent,
    NodeMapComponent,
    RewardScreenComponent,
    RestScreenComponent,
    ShopScreenComponent,
    EventScreenComponent,
    RelicInventoryComponent,
    ActTransitionComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([{ path: '', component: AscentComponent }]),
  ],
})
export class AscentModule {}

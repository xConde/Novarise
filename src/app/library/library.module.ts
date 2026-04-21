import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import { CardLibraryComponent } from './card-library.component';
import { LibraryCardTileComponent } from './components/library-card-tile.component';
import { CardDetailModalComponent } from './components/card-detail-modal.component';
import { LibraryFiltersComponent } from './components/library-filters.component';

@NgModule({
  declarations: [
    CardLibraryComponent,
    LibraryCardTileComponent,
    CardDetailModalComponent,
    LibraryFiltersComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: CardLibraryComponent }]),
    IconComponent,
  ],
})
export class LibraryModule {}

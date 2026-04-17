import { Component, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconName, IconDef, ICON_REGISTRY } from './icon-registry';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styles: [`:host { display: inline-flex; align-items: center; line-height: 0; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent implements OnChanges {
  @Input() name!: IconName;
  @Input() size?: number;
  @Input() fill?: string;
  @Input() stroke?: string;
  @Input() strokeWidth?: string;

  private static readonly FALLBACK: IconDef = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };

  def: IconDef = IconComponent.FALLBACK;
  resolvedFill = 'none';
  resolvedStroke = 'currentColor';
  resolvedStrokeWidth = '2';

  ngOnChanges(): void {
    this.def = ICON_REGISTRY[this.name] ?? IconComponent.FALLBACK;
    this.resolvedFill = this.fill ?? this.def.fill;
    this.resolvedStroke = this.stroke ?? this.def.stroke;
    this.resolvedStrokeWidth = this.strokeWidth ?? this.def.strokeWidth;
  }
}

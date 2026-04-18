import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {
  CardDefinition,
  CardEffect,
  CardType,
} from '../../run/models/card.model';
import { TOWER_CONFIGS, TowerType } from '../../game/game-board/models/tower.model';
import { FocusTrap } from '@shared/utils/focus-trap.util';

interface BalanceRow {
  readonly label: string;
  readonly base: string;
  readonly upgraded?: string;
}

/**
 * Detail modal for the /library card inspector. Read-only QA view of a
 * single CardDefinition: base effect, upgraded effect (when defined), a
 * raw-JSON `<details>` block for debugging, and a balance-number table.
 *
 * Backdrop click and Escape both close. Focus traps inside the modal
 * while open; returns focus to the previously-focused element on close.
 */
@Component({
  selector: 'app-card-detail-modal',
  templateUrl: './card-detail-modal.component.html',
  styleUrls: ['./card-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailModalComponent implements AfterViewInit, OnDestroy {
  @Input() definition!: CardDefinition;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('modal', { static: true }) modalRef!: ElementRef<HTMLElement>;

  private readonly focusTrap = new FocusTrap();

  readonly CardType = CardType;

  ngAfterViewInit(): void {
    this.focusTrap.activate(this.modalRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.focusTrap.deactivate();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    // Backdrop is the host; any click on a child bubbles with target !== currentTarget.
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  /** Upgrade panel is shown only when the card actually has an upgraded effect. */
  get hasUpgrade(): boolean {
    return this.definition.upgradedEffect !== undefined;
  }

  /** Gold cost shown on tower cards. Null for non-tower. */
  get goldCost(): number | null {
    if (this.definition.effect.type !== 'tower') return null;
    const tt = (this.definition.effect as { towerType: TowerType }).towerType;
    return TOWER_CONFIGS[tt]?.cost ?? null;
  }

  get keywordChips(): readonly string[] {
    const d = this.definition;
    const chips: string[] = [];
    if (d.innate)    chips.push('Innate');
    if (d.retain)    chips.push('Retain');
    if (d.ethereal)  chips.push('Ethereal');
    if (d.exhaust)   chips.push('Exhaust');
    if (d.terraform) chips.push('Terraform');
    if (d.link)      chips.push('Link');
    return chips;
  }

  /**
   * Balance rows rendered in the bottom table. Derives numeric fields
   * from the effect union and compares base vs upgraded so QA can eyeball
   * deltas without scrolling the raw JSON.
   */
  get balanceRows(): readonly BalanceRow[] {
    const base = this.definition.effect;
    const upg = this.definition.upgradedEffect;

    const row = (label: string, baseVal: unknown, upgVal: unknown): BalanceRow => ({
      label,
      base: stringifyValue(baseVal),
      upgraded: upgVal === undefined ? undefined : stringifyValue(upgVal),
    });

    const rows: BalanceRow[] = [];
    // Energy cost — mirrored as stat row 0 because the def owns it, not the effect.
    rows.push({
      label: 'Energy cost',
      base: String(this.definition.energyCost),
    });

    if (base.type === 'modifier') {
      const uM = upg?.type === 'modifier' ? upg : undefined;
      rows.push(row('Modifier stat', base.stat, uM?.stat));
      rows.push(row('Value', base.value, uM?.value));
      rows.push(row('Duration', base.duration, uM?.duration));
      rows.push(row('Scope', base.durationScope ?? 'wave', uM?.durationScope ?? (uM ? 'wave' : undefined)));
    } else if (base.type === 'spell') {
      const uS = upg?.type === 'spell' ? upg : undefined;
      rows.push(row('Spell id', base.spellId, uS?.spellId));
      rows.push(row('Value', base.value, uS?.value));
    } else if (base.type === 'utility') {
      const uU = upg?.type === 'utility' ? upg : undefined;
      rows.push(row('Utility id', base.utilityId, uU?.utilityId));
      rows.push(row('Value', base.value, uU?.value));
    } else if (base.type === 'tower') {
      const uT = upg?.type === 'tower' ? upg : undefined;
      rows.push(row('Tower type', base.towerType, uT?.towerType));
      if (base.startLevel !== undefined || uT?.startLevel !== undefined) {
        rows.push(row('Start level', base.startLevel ?? 1, uT?.startLevel ?? (uT ? 1 : undefined)));
      }
      // Stat overrides — collect any set keys across base + upgrade.
      const overrideKeys = new Set<string>([
        ...Object.keys(base.statOverrides ?? {}),
        ...Object.keys(uT?.statOverrides ?? {}),
      ]);
      for (const key of overrideKeys) {
        const baseOv = (base.statOverrides as Record<string, unknown> | undefined)?.[key];
        const upgOv = (uT?.statOverrides as Record<string, unknown> | undefined)?.[key];
        rows.push(row(`Override: ${key}`, baseOv, upgOv));
      }
    } else if (base.type === 'terraform_target') {
      const uTt = upg?.type === 'terraform_target' ? upg : undefined;
      rows.push(row('Op', base.op, uTt?.op));
      rows.push(row('Duration', base.duration, uTt?.duration));
      if (base.damageOnHit || uTt?.damageOnHit) {
        rows.push(row('Damage (% maxHP)', base.damageOnHit?.pctMaxHp, uTt?.damageOnHit?.pctMaxHp));
      }
    } else if (base.type === 'elevation_target') {
      const uE = upg?.type === 'elevation_target' ? upg : undefined;
      rows.push(row('Op', base.op, uE?.op));
      rows.push(row('Amount', base.amount, uE?.amount));
      rows.push(row('Duration', base.duration, uE?.duration));
      if (base.line || uE?.line) {
        rows.push(row('Line direction', base.line?.direction, uE?.line?.direction));
        rows.push(row('Line length', base.line?.length, uE?.line?.length));
      }
      if (base.damageOnHit || uE?.damageOnHit) {
        rows.push(row('Damage / elevation', base.damageOnHit?.damagePerElevation, uE?.damageOnHit?.damagePerElevation));
      }
    }

    return rows;
  }

  get rawJson(): string {
    return JSON.stringify(
      { effect: this.definition.effect, upgradedEffect: this.definition.upgradedEffect ?? null },
      null,
      2,
    );
  }

  /** Effect type label for the header badge (e.g. 'modifier' → 'Modifier'). */
  effectTypeLabel(effect: CardEffect): string {
    return effect.type.replace('_', ' ');
  }
}

function stringifyValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

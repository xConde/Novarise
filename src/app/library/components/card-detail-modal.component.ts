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
  EffectGlyphName,
} from '../../run/models/card.model';
import { TOWER_CONFIGS, TowerType } from '../../game/game-board/models/tower.model';
import { FocusTrap } from '@shared/utils/focus-trap.util';
import { ARCHETYPE_DISPLAY } from '../../run/constants/archetype.constants';
import { IconName } from '../../shared/components/icon/icon-registry';

interface BalanceRow {
  readonly label: string;
  readonly base: string;
  readonly upgraded?: string;
}

/**
 * Codex detail modal. Shows a single CardDefinition: base + upgraded
 * effect side-by-side, balance stats, and a collapsed raw-JSON block.
 * Backdrop click and Escape close. Focus traps while open and returns
 * focus to the previously-focused element on close.
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

  /**
   * Upgrade panel is shown only when the upgrade actually differs from the
   * base — otherwise the side-by-side renders two identical blocks. A few
   * cards ship an `upgradedEffect` with the same values as `effect` as a
   * placeholder for later tuning; we treat those as "no-upgrade" in the UI.
   */
  get hasUpgrade(): boolean {
    if (this.definition.upgradedEffect === undefined) return false;
    const baseDesc = this.definition.description;
    const upDesc = this.definition.upgradedDescription ?? baseDesc;
    return upDesc !== baseDesc;
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
    // Surface upgraded cost too when it differs (e.g., ARCHITECT 3E → 2E).
    rows.push({
      label: 'Energy cost',
      base: String(this.definition.energyCost),
      upgraded: this.definition.upgradedEnergyCost !== undefined
        ? String(this.definition.upgradedEnergyCost)
        : undefined,
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

  /** CSS var() for the archetype trim ring (inset box-shadow on modal shell). */
  get archetypeTrimColor(): string {
    const archetype = this.definition.archetype ?? 'neutral';
    const trimVar = ARCHETYPE_DISPLAY[archetype]?.trimVar ?? '--card-trim-neutral';
    return `var(${trimVar})`;
  }

  /** CSS var() for the archetype backdrop pattern in the header strip. */
  get archetypeBackdropVar(): string {
    switch (this.definition.archetype) {
      case 'cartographer': return 'var(--card-backdrop-cartographer)';
      case 'highground':   return 'var(--card-backdrop-highground)';
      case 'conduit':      return 'var(--card-backdrop-conduit)';
      case 'neutral':
      case 'siegeworks':
      default:             return 'var(--card-backdrop-neutral)';
    }
  }

  /** Icon name for the archetype sub-icon glyph. */
  get archetypeIconName(): IconName {
    switch (this.definition.archetype) {
      case 'cartographer': return 'arch-cartographer';
      case 'highground':   return 'arch-highground';
      case 'conduit':      return 'arch-conduit';
      case 'neutral':
      case 'siegeworks':
      default:             return 'arch-neutral';
    }
  }

  /** True when the card places a tower (footprint preview should render). */
  get isTowerCard(): boolean {
    return this.definition.type === CardType.TOWER;
  }

  /** Primary effect glyph for non-tower cards (rendered in the modal art-strip). */
  get primaryGlyph(): EffectGlyphName | null {
    const g = this.definition.effectGlyph;
    if (!g) return null;
    return Array.isArray(g) ? g[0] : g;
  }

  /** Secondary glyph as a small accent when effectGlyph is a 2-tuple. */
  get secondaryGlyph(): EffectGlyphName | null {
    const g = this.definition.effectGlyph;
    return Array.isArray(g) ? g[1] : null;
  }
}

function stringifyValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

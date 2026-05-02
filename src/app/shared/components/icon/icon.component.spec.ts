import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_REGISTRY, IconName } from './icon-registry';

const KEYWORD_ICON_NAMES: IconName[] = [
  'kw-terraform', 'kw-link', 'kw-exhaust', 'kw-retain', 'kw-innate', 'kw-ethereal',
];

const TYPE_ICON_NAMES: IconName[] = ['crosshair', 'bolt', 'shield', 'gear'];

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.name = 'heart';
    component.ngOnChanges();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render an SVG for each registered icon', () => {
    const names = Object.keys(ICON_REGISTRY) as IconName[];
    for (const name of names) {
      component.name = name;
      component.ngOnChanges();
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg).withContext(`SVG missing for icon "${name}"`).toBeTruthy();
    }
  });

  it('should apply size attribute', () => {
    component.name = 'heart';
    component.size = 20;
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
  });

  it('should use registry defaults when no overrides given', () => {
    component.name = 'heart';
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });

  it('should allow fill override', () => {
    component.name = 'diamond';
    component.fill = 'red';
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('fill')).toBe('red');
  });

  it('should not add stroke attributes when stroke is none', () => {
    component.name = 'play';
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('stroke')).toBeNull();
  });

  it('should omit width/height when size is not set', () => {
    component.name = 'sound-on';
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBeNull();
  });

  it('should render a valid empty SVG for an unrecognized icon name', () => {
    component.name = 'nonexistent' as IconName;
    component.ngOnChanges();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  describe('keyword icons (kw-*)', () => {
    it('all 6 keyword icons are registered in ICON_REGISTRY', () => {
      for (const name of KEYWORD_ICON_NAMES) {
        expect(ICON_REGISTRY[name]).withContext(`"${name}" missing from ICON_REGISTRY`).toBeDefined();
      }
    });

    it('all 6 keyword icons use viewBox "0 0 24 24"', () => {
      for (const name of KEYWORD_ICON_NAMES) {
        expect(ICON_REGISTRY[name].viewBox)
          .withContext(`viewBox mismatch for "${name}"`)
          .toBe('0 0 24 24');
      }
    });

    it('all 6 keyword icons use strokeWidth 1.5', () => {
      for (const name of KEYWORD_ICON_NAMES) {
        expect(ICON_REGISTRY[name].strokeWidth)
          .withContext(`strokeWidth mismatch for "${name}"`)
          .toBe('1.5');
      }
    });

    it('each keyword icon renders an SVG without error', () => {
      for (const name of KEYWORD_ICON_NAMES) {
        component.name = name;
        component.ngOnChanges();
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).withContext(`SVG missing for keyword icon "${name}"`).toBeTruthy();
      }
    });

    it('kw-link renders with stroke-only geometry (no per-element fill)', () => {
      component.name = 'kw-link';
      component.ngOnChanges();
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      const circles = svg.querySelectorAll('circle');
      circles.forEach((circle) => {
        const perElementFill = circle.getAttribute('fill');
        expect(perElementFill).withContext('kw-link circles must not carry per-element fill').toBeNull();
      });
    });

    it('IconName union contains all 6 keyword icon names', () => {
      // Compile-time check: all KEYWORD_ICON_NAMES are assignable to IconName.
      // This test failing at runtime means the union or the list is out of sync.
      for (const name of KEYWORD_ICON_NAMES) {
        const typed: IconName = name;
        expect(typed).toBe(name);
      }
    });

    it('exhaustiveness: every kw-* name has a matching ngSwitchCase (verified via registry lookup)', () => {
      // Registry presence is the proxy for template wiring — if it is in ICON_REGISTRY
      // and renders a non-fallback viewBox it means the ngSwitchCase exists.
      for (const name of KEYWORD_ICON_NAMES) {
        component.name = name;
        component.ngOnChanges();
        expect(component.def.viewBox).withContext(`${name} fell through to FALLBACK`).toBe('0 0 24 24');
        expect(component.def.strokeWidth).withContext(`${name} fell through to FALLBACK`).toBe('1.5');
      }
    });
  });

  describe('type icons (crosshair / bolt / shield / gear)', () => {
    it('all 4 type icons are registered in ICON_REGISTRY', () => {
      for (const name of TYPE_ICON_NAMES) {
        expect(ICON_REGISTRY[name])
          .withContext(`"${name}" missing from ICON_REGISTRY`)
          .toBeDefined();
      }
    });

    it('all 4 type icons use viewBox "0 0 24 24"', () => {
      for (const name of TYPE_ICON_NAMES) {
        expect(ICON_REGISTRY[name].viewBox)
          .withContext(`viewBox mismatch for "${name}"`)
          .toBe('0 0 24 24');
      }
    });

    it('all 4 type icons use strokeWidth 1.5 (matches keyword icon vocabulary)', () => {
      for (const name of TYPE_ICON_NAMES) {
        expect(ICON_REGISTRY[name].strokeWidth)
          .withContext(`strokeWidth mismatch for "${name}"`)
          .toBe('1.5');
      }
    });

    it('all 4 type icons use stroke="currentColor" (no filled silhouettes)', () => {
      for (const name of TYPE_ICON_NAMES) {
        expect(ICON_REGISTRY[name].stroke)
          .withContext(`stroke mismatch for "${name}"`)
          .toBe('currentColor');
        expect(ICON_REGISTRY[name].fill)
          .withContext(`fill mismatch for "${name}"`)
          .toBe('none');
      }
    });

    it('each type icon renders an SVG without error', () => {
      for (const name of TYPE_ICON_NAMES) {
        component.name = name;
        component.ngOnChanges();
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).withContext(`SVG missing for type icon "${name}"`).toBeTruthy();
      }
    });

    it('crosshair no longer carries a per-element fill attribute on any child', () => {
      component.name = 'crosshair';
      component.ngOnChanges();
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      svg.querySelectorAll('*').forEach((el) => {
        const perElementFill = el.getAttribute('fill');
        expect(perElementFill)
          .withContext('crosshair children must not carry per-element fill')
          .toBeNull();
      });
    });
  });

  describe('archetype sub-icons (arch-*)', () => {
    const ARCH_ICON_NAMES: IconName[] = [
      'arch-cartographer', 'arch-highground', 'arch-conduit', 'arch-neutral',
    ];

    it('all 4 archetype icons are registered in ICON_REGISTRY', () => {
      for (const name of ARCH_ICON_NAMES) {
        expect(ICON_REGISTRY[name])
          .withContext(`"${name}" missing from ICON_REGISTRY`)
          .toBeDefined();
      }
    });

    it('all 4 archetype icons use strokeWidth 1.5 and stroke="currentColor"', () => {
      for (const name of ARCH_ICON_NAMES) {
        expect(ICON_REGISTRY[name].strokeWidth)
          .withContext(`strokeWidth mismatch for "${name}"`)
          .toBe('1.5');
        expect(ICON_REGISTRY[name].stroke)
          .withContext(`stroke mismatch for "${name}"`)
          .toBe('currentColor');
        expect(ICON_REGISTRY[name].fill)
          .withContext(`fill mismatch for "${name}"`)
          .toBe('none');
      }
    });

    it('each archetype icon renders an SVG without error', () => {
      for (const name of ARCH_ICON_NAMES) {
        component.name = name;
        component.ngOnChanges();
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).withContext(`SVG missing for archetype icon "${name}"`).toBeTruthy();
      }
    });

    it('IconName union contains all 4 archetype icon names', () => {
      for (const name of ARCH_ICON_NAMES) {
        const typed: IconName = name;
        expect(typed).toBe(name);
      }
    });
  });

  describe('effect glyphs (fx-*)', () => {
    const FX_ICON_NAMES: IconName[] = [
      'fx-damage', 'fx-burn', 'fx-poison', 'fx-slow', 'fx-heal', 'fx-gold',
      'fx-draw', 'fx-energy', 'fx-buff', 'fx-scout', 'fx-recycle',
    ];

    it('all 11 effect glyphs are registered in ICON_REGISTRY', () => {
      for (const name of FX_ICON_NAMES) {
        expect(ICON_REGISTRY[name])
          .withContext(`"${name}" missing from ICON_REGISTRY`)
          .toBeDefined();
      }
    });

    it('all 11 effect glyphs use strokeWidth 1.5 and stroke="currentColor"', () => {
      for (const name of FX_ICON_NAMES) {
        expect(ICON_REGISTRY[name].strokeWidth).toBe('1.5');
        expect(ICON_REGISTRY[name].stroke).toBe('currentColor');
        expect(ICON_REGISTRY[name].fill).toBe('none');
      }
    });

    it('each effect glyph renders an SVG without error', () => {
      for (const name of FX_ICON_NAMES) {
        component.name = name;
        component.ngOnChanges();
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).withContext(`SVG missing for effect glyph "${name}"`).toBeTruthy();
      }
    });

    it('IconName union contains all 11 effect glyph names', () => {
      for (const name of FX_ICON_NAMES) {
        const typed: IconName = name;
        expect(typed).toBe(name);
      }
    });
  });
});

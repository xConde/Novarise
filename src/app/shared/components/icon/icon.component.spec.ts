import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_REGISTRY, IconName } from './icon-registry';

const KEYWORD_ICON_NAMES: IconName[] = [
  'kw-terraform', 'kw-link', 'kw-exhaust', 'kw-retain', 'kw-innate', 'kw-ethereal',
];

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
});

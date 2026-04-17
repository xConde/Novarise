import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_REGISTRY, IconName } from './icon-registry';

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
});

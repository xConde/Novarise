import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { By } from '@angular/platform-browser';
import { DescriptionTextComponent, parseDescription } from './description-text.component';

// ── parseDescription unit tests ──────────────────────────────────────────────

describe('parseDescription', () => {
  it('returns a single text segment for a plain string with no tokens', () => {
    const segs = parseDescription('Deploy a Basic tower.');
    expect(segs.length).toBe(1);
    expect(segs[0]).toEqual({ type: 'text', value: 'Deploy a Basic tower.' });
  });

  it('returns an empty array for an empty string', () => {
    expect(parseDescription('')).toEqual([]);
  });

  it('parses a single {kw-terraform} token in the middle of text', () => {
    const segs = parseDescription('Apply {kw-terraform} for 2 turns.');
    expect(segs).toEqual([
      { type: 'text', value: 'Apply ' },
      { type: 'icon', name: 'terraform', label: 'Terraform' },
      { type: 'text', value: ' for 2 turns.' },
    ]);
  });

  it('parses a token at the start of the string', () => {
    const segs = parseDescription('{kw-exhaust} this card after playing.');
    expect(segs[0]).toEqual({ type: 'icon', name: 'exhaust', label: 'Exhaust' });
    expect(segs[1]).toEqual({ type: 'text', value: ' this card after playing.' });
  });

  it('parses a token at the end of the string', () => {
    const segs = parseDescription('Always in opening hand. {kw-innate}');
    expect(segs[segs.length - 1]).toEqual({ type: 'icon', name: 'innate', label: 'Innate' });
  });

  it('parses multiple tokens and counts them correctly', () => {
    const segs = parseDescription('{kw-link} forms a chain. Uses {kw-exhaust}.');
    const iconSegs = segs.filter(s => s.type === 'icon');
    expect(iconSegs.length).toBe(2);
  });

  it('passes unknown {kw-foobar} token through as plain text without error', () => {
    const segs = parseDescription('Has {kw-foobar} effect.');
    const icon = segs.find(s => s.type === 'icon');
    const raw = segs.find(s => s.type === 'text' && s.value === '{kw-foobar}');
    expect(icon).toBeUndefined();
    expect(raw).toBeDefined();
  });

  it('produces correct labels — title-cased keyword name', () => {
    const segs = parseDescription('{kw-retain}');
    const iconSeg = segs.find(s => s.type === 'icon');
    expect(iconSeg).toBeDefined();
    if (iconSeg && iconSeg.type === 'icon') {
      expect(iconSeg.label).toBe('Retain');
    }
  });

  it('handles all 6 valid keyword names without error', () => {
    const desc = '{kw-terraform}{kw-link}{kw-exhaust}{kw-retain}{kw-innate}{kw-ethereal}';
    const segs = parseDescription(desc);
    expect(segs.filter(s => s.type === 'icon').length).toBe(6);
  });

  it('text-only segments carry the original text value unchanged', () => {
    const segs = parseDescription('No tokens here, only text with numbers 42.');
    const seg = segs[0];
    expect(seg.type).toBe('text');
    if (seg.type === 'text') {
      expect(seg.value).toBe('No tokens here, only text with numbers 42.');
    }
  });
});

// ── DescriptionTextComponent DOM tests ───────────────────────────────────────

describe('DescriptionTextComponent', () => {
  let component: DescriptionTextComponent;
  let fixture: ComponentFixture<DescriptionTextComponent>;

  /**
   * Helper: set the description input and trigger change detection.
   * Manually calls ngOnChanges because directly setting a property on the
   * component instance does not fire the lifecycle hook — only parent-driven
   * binding does. ngOnChanges({}) is the standard test workaround.
   */
  function setDescription(desc: string, size?: number): void {
    component.description = desc;
    if (size !== undefined) component.iconSize = size;
    component.ngOnChanges();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DescriptionTextComponent, CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DescriptionTextComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders plain text without any icon elements', () => {
    setDescription('Deploy a Sniper tower.');
    const icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Deploy a Sniper tower.');
  });

  it('renders empty description without error', () => {
    setDescription('');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('renders one icon for a description with one {kw-terraform} token', () => {
    setDescription('Apply {kw-terraform} to this tile.');
    const icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(1);
  });

  it('renders two icons for a description with two keyword tokens', () => {
    setDescription('{kw-link} grants {kw-exhaust}.');
    const icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(2);
  });

  it('renders unknown {kw-foobar} as plain text without an icon', () => {
    setDescription('Has {kw-foobar} effect.');
    const icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('{kw-foobar}');
  });

  it('applies the correct modifier class for each keyword', () => {
    setDescription('{kw-retain}');
    const icon = fixture.debugElement.query(By.css('.desc-text__icon--retain'));
    expect(icon).not.toBeNull();
  });

  it('applies aria-label to the wrapping span with the full description text', () => {
    const desc = 'Apply {kw-innate} always.';
    setDescription(desc);
    const span = fixture.debugElement.query(By.css('.desc-text'));
    expect(span.nativeElement.getAttribute('aria-label')).toBe(desc);
  });

  it('icon spans are aria-hidden so screen readers use the parent aria-label', () => {
    setDescription('{kw-ethereal} effect.');
    const iconSpans = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    iconSpans.forEach(span => {
      expect(span.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('rebuilds segments on input change', () => {
    setDescription('First.');
    let icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(0);

    setDescription('{kw-terraform} second.');
    icons = fixture.debugElement.queryAll(By.css('.desc-text__icon'));
    expect(icons.length).toBe(1);
  });

  it('uses the iconSize input to pass size to the icon component', () => {
    setDescription('{kw-link}', 20);
    const svg = fixture.debugElement.query(By.css('svg'));
    expect(svg).not.toBeNull();
    expect(svg.nativeElement.getAttribute('width')).toBe('20');
  });
});

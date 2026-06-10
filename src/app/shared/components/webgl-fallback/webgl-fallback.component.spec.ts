import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { WebglFallbackComponent } from './webgl-fallback.component';

describe('WebglFallbackComponent', () => {
  let fixture: ComponentFixture<WebglFallbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebglFallbackComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(WebglFallbackComponent);
    fixture.detectChanges();
  });

  it('renders the panel heading', () => {
    const title = fixture.debugElement.query(By.css('.webgl-fallback__title'));
    expect(title).not.toBeNull();
    expect(title.nativeElement.textContent).toContain('Battlefield rendering unavailable');
  });

  it('renders the explanatory body paragraph', () => {
    const body = fixture.debugElement.query(By.css('.webgl-fallback__body'));
    expect(body).not.toBeNull();
    expect(body.nativeElement.textContent).toContain('WebGL');
  });

  it('renders at least one troubleshooting tip', () => {
    const tips = fixture.debugElement.queryAll(By.css('.webgl-fallback__tips li'));
    expect(tips.length).toBeGreaterThan(0);
  });

  it('renders a Back to Menu link pointing to "/"', () => {
    const link = fixture.debugElement.query(By.css('.webgl-fallback__back-btn'));
    expect(link).not.toBeNull();
    // routerLink directive resolves to href after fixture setup
    expect(link.nativeElement.getAttribute('href')).toBe('/');
  });

  it('has role="main" on the root element for accessibility', () => {
    const root = fixture.debugElement.query(By.css('.webgl-fallback'));
    expect(root.nativeElement.getAttribute('role')).toBe('main');
  });

  it('heading is associated with aria-labelledby on the root element', () => {
    const root = fixture.debugElement.query(By.css('.webgl-fallback'));
    const labelledById = root.nativeElement.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const heading = fixture.nativeElement.querySelector(`#${labelledById}`);
    expect(heading).not.toBeNull();
  });
});

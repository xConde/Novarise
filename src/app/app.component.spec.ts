import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

describe('AppComponent', () => {
  let originalDevTools: boolean;

  beforeEach(async () => {
    originalDevTools = environment.enableDevTools;
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [
        AppComponent
      ],
    }).compileComponents();
  });

  afterEach(() => {
    (environment as { enableDevTools: boolean }).enableDevTools = originalDevTools;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'Novarise'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Novarise');
  });

  it('renders Home and Editor nav links (non-dev build)', () => {
    (environment as { enableDevTools: boolean }).enableDevTools = false;
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLinks = compiled.querySelectorAll('.app-nav a');
    expect(navLinks.length).toBe(2);
    expect(navLinks[0].textContent).toContain('Home');
    expect(navLinks[1].textContent).toContain('Editor');
    const cog = compiled.querySelector('.settings-cog');
    expect(cog).toBeTruthy();
    expect(cog!.getAttribute('aria-label')).toBe('Settings');
  });

  it('renders Library link next to Editor in dev builds', () => {
    (environment as { enableDevTools: boolean }).enableDevTools = true;
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLinks = compiled.querySelectorAll('.app-nav a');
    expect(navLinks.length).toBe(3);
    expect(navLinks[2].textContent?.trim()).toBe('Library');
  });
});

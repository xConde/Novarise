import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [
        AppComponent
      ],
    }).compileComponents();
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

  it('should render navigation links', () => {
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
});

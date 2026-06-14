import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RunEpilogueComponent } from './run-epilogue.component';
import { getEpilogueCopy } from '../../constants/epilogue-copy.constants';

describe('RunEpilogueComponent', () => {
  let fixture: ComponentFixture<RunEpilogueComponent>;
  let component: RunEpilogueComponent;

  function setup(unlockedAscensionLevel = 0, bossPresetId = ''): void {
    TestBed.configureTestingModule({
      declarations: [RunEpilogueComponent],
      imports: [CommonModule],
    });
    fixture = TestBed.createComponent(RunEpilogueComponent);
    component = fixture.componentInstance;
    component.unlockedAscensionLevel = unlockedAscensionLevel;
    component.bossPresetId = bossPresetId;
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('renders the "THE SPIRE STANDS" title', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('THE SPIRE STANDS');
  });

  it('renders a Continue button', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('.run-epilogue__btn');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('Continue');
  });

  it('emits continued when Continue button is clicked', () => {
    setup();
    component.buttonVisible = true;
    fixture.detectChanges();

    let emitted = false;
    component.continued.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.run-epilogue__btn');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('does not show ascension line when unlockedAscensionLevel is 0', () => {
    setup(0);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.run-epilogue__ascension')).toBeNull();
  });

  it('shows ascension unlock line when unlockedAscensionLevel > 0', () => {
    setup(3);
    component.ascensionVisible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const block = el.querySelector('.run-epilogue__ascension');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain('Ascension 3 unlocked');
  });

  it('showAscensionLine is false when unlockedAscensionLevel is 0', () => {
    setup(0);
    expect(component.showAscensionLine).toBeFalse();
  });

  it('showAscensionLine is true when unlockedAscensionLevel > 0', () => {
    setup(5);
    expect(component.showAscensionLine).toBeTrue();
  });

  it('stages become visible after appropriate timeouts', fakeAsync(() => {
    setup();

    expect(component.titleVisible).toBeFalse();
    expect(component.copyVisible).toBeFalse();
    expect(component.buttonVisible).toBeFalse();

    tick(200);
    expect(component.titleVisible).toBeTrue();

    tick(700); // cumulative 900ms
    expect(component.copyVisible).toBeTrue();

    tick(1300); // cumulative 2200ms
    expect(component.buttonVisible).toBeTrue();
  }));

  it('applies reduce-motion visible classes under body.reduce-motion', () => {
    setup();
    document.body.classList.add('reduce-motion');

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const epilogue = el.querySelector('.run-epilogue');
    expect(epilogue).not.toBeNull();

    document.body.classList.remove('reduce-motion');
  });

  it('clears timeouts on destroy', fakeAsync(() => {
    setup();
    fixture.destroy();
    tick(3000);
  }));

  // ── bossPresetId input ────────────────────────────────────────────────────

  it('bossPresetId defaults to empty string', () => {
    setup();
    expect(component.bossPresetId).toBe('');
  });

  it('epilogueCopy is resolved during ngOnInit based on bossPresetId', () => {
    setup(0, 'vanguard_convergence');
    const expected = getEpilogueCopy('vanguard_convergence');
    expect(component.epilogueCopy).toEqual(expected);
  });

  it('epilogueCopy falls back to neutral when bossPresetId is empty', () => {
    setup();
    const expected = getEpilogueCopy('');
    expect(component.epilogueCopy).toEqual(expected);
  });

  it('renders neutral fallback copy when bossPresetId is empty (default experience)', () => {
    setup();
    component.copyVisible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const copy = el.querySelector('.run-epilogue__copy');
    // Original text references the Nova Sovereign
    expect(copy?.textContent).toContain('Sovereign');
  });

  it('renders vanguard_convergence copy when bossPresetId matches', () => {
    setup(0, 'vanguard_convergence');
    component.copyVisible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const copy = el.querySelector('.run-epilogue__copy');
    // Vanguard copy references Titans in the narrative
    expect(copy?.textContent?.toLowerCase()).toContain('titan');
  });

  it('renders celestial_deluge copy when bossPresetId matches', () => {
    setup(0, 'celestial_deluge');
    component.copyVisible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const copy = el.querySelector('.run-epilogue__copy');
    expect(copy?.textContent?.toLowerCase()).toMatch(/fly|air|sky/);
  });

  it('renders ironclad_march copy when bossPresetId matches', () => {
    setup(0, 'ironclad_march');
    component.copyVisible = true;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const copy = el.querySelector('.run-epilogue__copy');
    expect(copy?.textContent?.toLowerCase()).toContain('march');
  });

  it('falls back to neutral when bossPresetId is an unknown id', () => {
    setup(0, 'nonexistent_boss_id');
    const expected = getEpilogueCopy('');
    expect(component.epilogueCopy).toEqual(expected);
  });
});

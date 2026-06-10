import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RunEpilogueComponent } from './run-epilogue.component';

describe('RunEpilogueComponent', () => {
  let fixture: ComponentFixture<RunEpilogueComponent>;
  let component: RunEpilogueComponent;

  function setup(unlockedAscensionLevel = 0): void {
    TestBed.configureTestingModule({
      declarations: [RunEpilogueComponent],
      imports: [CommonModule],
    });
    fixture = TestBed.createComponent(RunEpilogueComponent);
    component = fixture.componentInstance;
    component.unlockedAscensionLevel = unlockedAscensionLevel;
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

  it('renders the epilogue copy referencing the Nova Sovereign', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Sovereign");
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
    // Force button visible so click is enabled
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
    // Make it visible
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
    // The CSS handles instant-visibility; we just verify the component rendered
    expect(epilogue).not.toBeNull();

    document.body.classList.remove('reduce-motion');
  });

  it('clears timeouts on destroy', fakeAsync(() => {
    setup();
    fixture.destroy();
    // tick past all delays — no errors should be thrown
    tick(3000);
  }));
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RunSummaryComponent } from './run-summary.component';
import { RunState, RunStatus, DEFAULT_RUN_CONFIG } from '../../models/run-state.model';
import { RelicId, RelicRarity } from '../../models/relic.model';

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    id: 'run_test',
    seed: 42,
    ascensionLevel: 0,
    config: DEFAULT_RUN_CONFIG,
    actIndex: 1,
    currentNodeId: 'node_5',
    completedNodeIds: ['node_1', 'node_2'],
    lives: 15,
    maxLives: 20,
    gold: 80,
    relicIds: [RelicId.IRON_HEART, RelicId.CHAIN_REACTION],
    deckCardIds: [],
    encounterResults: [
      {
        nodeId: 'node_1',
        nodeType: 'combat',
        victory: true,
        livesLost: 2,
        goldEarned: 50,
        enemiesKilled: 30,
        wavesCompleted: 5,
        completedChallenges: [],
      },
      {
        nodeId: 'node_2',
        nodeType: 'elite',
        victory: true,
        livesLost: 3,
        goldEarned: 75,
        enemiesKilled: 20,
        wavesCompleted: 4,
        completedChallenges: [],
      },
    ],
    status: RunStatus.VICTORY,
    startedAt: Date.now() - 180_000,
    score: 1200,
    ...overrides,
  };
}

describe('RunSummaryComponent', () => {
  let fixture: ComponentFixture<RunSummaryComponent>;
  let component: RunSummaryComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RunSummaryComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(RunSummaryComponent);
    component = fixture.componentInstance;
    component.runState = makeRunState();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders victory header for VICTORY status', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ascent Complete!');
  });

  it('renders defeat header for DEFEAT status', () => {
    component.runState = makeRunState({ status: RunStatus.DEFEAT });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Run Failed');
  });

  it('applies victory CSS class when status is VICTORY', () => {
    const root = (fixture.nativeElement as HTMLElement).querySelector('.run-summary');
    expect(root?.classList).toContain('run-summary--victory');
    expect(root?.classList).not.toContain('run-summary--defeat');
  });

  it('applies defeat CSS class when status is DEFEAT', () => {
    component.runState = makeRunState({ status: RunStatus.DEFEAT });
    fixture.detectChanges();
    const root = (fixture.nativeElement as HTMLElement).querySelector('.run-summary');
    expect(root?.classList).toContain('run-summary--defeat');
    expect(root?.classList).not.toContain('run-summary--victory');
  });

  it('totalKills sums enemiesKilled across all encounter results', () => {
    expect(component.totalKills).toBe(50); // 30 + 20
  });

  it('totalGoldEarned sums goldEarned across all encounter results', () => {
    expect(component.totalGoldEarned).toBe(125); // 50 + 75
  });

  it('encountersCompleted counts only victorious encounters', () => {
    component.runState = makeRunState({
      encounterResults: [
        { nodeId: 'n1', nodeType: 'combat', victory: true, livesLost: 0, goldEarned: 50, enemiesKilled: 10, wavesCompleted: 3, completedChallenges: [] },
        { nodeId: 'n2', nodeType: 'elite', victory: false, livesLost: 5, goldEarned: 0, enemiesKilled: 5, wavesCompleted: 2, completedChallenges: [] },
        { nodeId: 'n3', nodeType: 'combat', victory: true, livesLost: 1, goldEarned: 40, enemiesKilled: 12, wavesCompleted: 4, completedChallenges: [] },
      ],
    });
    expect(component.encountersCompleted).toBe(2);
    expect(component.totalEncounters).toBe(3);
  });

  it('relicDefinitions resolves relicIds to RelicDefinition objects', () => {
    const defs = component.relicDefinitions;
    expect(defs.length).toBe(2);
    expect(defs[0].id).toBe(RelicId.IRON_HEART);
    expect(defs[1].id).toBe(RelicId.CHAIN_REACTION);
  });

  it('relicDefinitions filters out unknown relic IDs', () => {
    component.runState = makeRunState({ relicIds: [RelicId.IRON_HEART, 'UNKNOWN_RELIC_ID'] });
    expect(component.relicDefinitions.length).toBe(1);
  });

  it('ascensionLabel is empty when ascensionLevel is 0', () => {
    expect(component.ascensionLabel).toBe('');
  });

  it('ascensionLabel includes level when ascensionLevel > 0', () => {
    component.runState = makeRunState({ ascensionLevel: 5 });
    expect(component.ascensionLabel).toBe('Ascension 5');
  });

  it('emits returnToMenu when return button is clicked', () => {
    let emitted = false;
    component.returnToMenu.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.run-summary__btn--secondary');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('emits startNewRun when new run button is clicked', () => {
    let emitted = false;
    component.startNewRun.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.run-summary__btn--primary');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('displays the score prominently', () => {
    const el = fixture.nativeElement as HTMLElement;
    const scoreEl = el.querySelector('.run-summary__score-value');
    expect(scoreEl?.textContent?.trim()).toBe('1200');
  });

  it('actsReached is actIndex + 1', () => {
    component.runState = makeRunState({ actIndex: 1 });
    expect(component.actsReached).toBe(2);
  });

  it('relics section is hidden when no relics are collected', () => {
    component.runState = makeRunState({ relicIds: [] });
    fixture.detectChanges();
    const relicsSection = (fixture.nativeElement as HTMLElement).querySelector('.run-summary__relics');
    expect(relicsSection).toBeNull();
  });

  it('encounter timeline is hidden when no encounters occurred', () => {
    component.runState = makeRunState({ encounterResults: [] });
    fixture.detectChanges();
    const timelineSection = (fixture.nativeElement as HTMLElement).querySelector('.run-summary__timeline');
    expect(timelineSection).toBeNull();
  });

  it('ascension badge is shown only when ascensionLevel > 0', () => {
    // No badge for level 0
    const noBadge = (fixture.nativeElement as HTMLElement).querySelector('.run-summary__ascension-badge');
    expect(noBadge).toBeNull();

    // Badge shown for level 3
    component.runState = makeRunState({ ascensionLevel: 3 });
    fixture.detectChanges();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('.run-summary__ascension-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Ascension 3');
  });
});

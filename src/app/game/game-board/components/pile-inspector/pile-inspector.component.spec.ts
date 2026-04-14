import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { PileInspectorComponent } from './pile-inspector.component';
import { CardId, CardInstance } from '../../../../run/models/card.model';

function makeInstance(cardId: CardId, upgraded = false, suffix = ''): CardInstance {
  return { instanceId: `inst_${cardId}${suffix}`, cardId, upgraded };
}

describe('PileInspectorComponent', () => {
  let component: PileInspectorComponent;
  let fixture: ComponentFixture<PileInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PileInspectorComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PileInspectorComponent);
    component = fixture.componentInstance;
    component.pile = [];
    component.label = 'Draw Pile';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('groupedCards', () => {
    it('returns empty array for empty pile', () => {
      component.pile = [];
      expect(component.groupedCards).toEqual([]);
    });

    it('groups identical cards by cardId and upgraded flag', () => {
      component.pile = [
        makeInstance(CardId.TOWER_BASIC, false, '_a'),
        makeInstance(CardId.TOWER_BASIC, false, '_b'),
        makeInstance(CardId.GOLD_RUSH, false),
      ];
      const groups = component.groupedCards;
      expect(groups.length).toBe(2);
      const basicGroup = groups.find(g => g.cardId === CardId.TOWER_BASIC);
      expect(basicGroup?.count).toBe(2);
    });

    it('separates base and upgraded versions of the same card', () => {
      component.pile = [
        makeInstance(CardId.TOWER_BASIC, false, '_base'),
        makeInstance(CardId.TOWER_BASIC, true, '_up'),
      ];
      const groups = component.groupedCards;
      expect(groups.length).toBe(2);
    });

    it('appends "+" to upgraded card name', () => {
      component.pile = [makeInstance(CardId.TOWER_BASIC, true)];
      const groups = component.groupedCards;
      expect(groups[0].name).toMatch(/\+$/);
    });

    it('sorts groups alphabetically by name', () => {
      component.pile = [
        makeInstance(CardId.GOLD_RUSH, false),
        makeInstance(CardId.TOWER_BASIC, false),
      ];
      const groups = component.groupedCards;
      expect(groups[0].name.localeCompare(groups[1].name)).toBeLessThan(0);
    });
  });

  describe('close', () => {
    it('emits closed event', () => {
      let emitCount = 0;
      component.closed.subscribe(() => { emitCount++; });
      component.close();
      expect(emitCount).toBe(1);
    });
  });

  describe('onEscape', () => {
    it('calls close when escape is pressed', () => {
      spyOn(component, 'close');
      component.onEscape();
      expect(component.close).toHaveBeenCalled();
    });
  });

  describe('onBackdropClick', () => {
    it('closes when clicking directly on the backdrop', () => {
      spyOn(component, 'close');
      const mockEl = {} as EventTarget;
      const event = { target: mockEl, currentTarget: mockEl } as MouseEvent;
      component.onBackdropClick(event);
      expect(component.close).toHaveBeenCalled();
    });

    it('does not close when clicking inside the modal content', () => {
      spyOn(component, 'close');
      const innerEl = {} as EventTarget;
      const outerEl = {} as EventTarget;
      const event = { target: innerEl, currentTarget: outerEl } as MouseEvent;
      component.onBackdropClick(event);
      expect(component.close).not.toHaveBeenCalled();
    });
  });
});

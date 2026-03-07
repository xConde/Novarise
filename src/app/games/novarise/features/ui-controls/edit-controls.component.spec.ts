import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { EditControlsComponent } from './edit-controls.component';
import { MapTemplate } from '../../core/map-template.model';

describe('EditControlsComponent', () => {
  let component: EditControlsComponent;
  let fixture: ComponentFixture<EditControlsComponent>;

  const MOCK_TEMPLATES: MapTemplate[] = [
    { id: 'classic', name: 'Classic', description: 'A classic layout' },
    { id: 'maze', name: 'Maze', description: 'A maze layout' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditControlsComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(EditControlsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default templates to an empty array', () => {
    expect(component.templates).toEqual([]);
  });

  describe('selectTemplate', () => {
    it('should emit templateSelect with the given id', () => {
      spyOn(component.templateSelect, 'emit');
      component.selectTemplate('maze');
      expect(component.templateSelect.emit).toHaveBeenCalledWith('maze');
    });
  });

  describe('template rendering', () => {
    it('should not render template section when templates is empty', () => {
      component.templates = [];
      fixture.detectChanges();
      component.isCollapsed = false;
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.template-grid')).toBeNull();
    });

    it('should render template buttons when templates are provided', () => {
      component.templates = MOCK_TEMPLATES;
      fixture.detectChanges();
      component.isCollapsed = false;
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent.trim()).toBe('Classic');
      expect(buttons[1].textContent.trim()).toBe('Maze');
    });

    it('should set title attribute from template description', () => {
      component.templates = MOCK_TEMPLATES;
      fixture.detectChanges();
      component.isCollapsed = false;
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      expect(buttons[0].getAttribute('title')).toBe('A classic layout');
    });

    it('should emit templateSelect when a template button is clicked', () => {
      component.templates = MOCK_TEMPLATES;
      fixture.detectChanges();
      component.isCollapsed = false;
      fixture.detectChanges();
      spyOn(component.templateSelect, 'emit');
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      buttons[1].click();
      expect(component.templateSelect.emit).toHaveBeenCalledWith('maze');
    });
  });

  describe('existing functionality', () => {
    it('should emit editModeChange when setMode is called', () => {
      spyOn(component.editModeChange, 'emit');
      component.setMode('height');
      expect(component.editModeChange.emit).toHaveBeenCalledWith('height');
    });

    it('should emit activeToolChange when setTool is called', () => {
      spyOn(component.activeToolChange, 'emit');
      component.setTool('fill');
      expect(component.activeToolChange.emit).toHaveBeenCalledWith('fill');
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { EditControlsComponent } from './edit-controls.component';
import { MapTemplate } from '@core/models/map-template.model';

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

  describe('template rendering (desktop)', () => {
    /** Run ngOnInit first, then force desktop mode */
    function initDesktop(): void {
      fixture.detectChanges(); // triggers ngOnInit → checkMobile
      component.isMobile = false;
      component.isCollapsed = false;
      fixture.detectChanges();
    }

    it('should not render template section when templates is empty', () => {
      component.templates = [];
      initDesktop();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.template-grid')).toBeNull();
    });

    it('should render template buttons when templates are provided', () => {
      component.templates = MOCK_TEMPLATES;
      initDesktop();
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent.trim()).toBe('Classic');
      expect(buttons[1].textContent.trim()).toBe('Maze');
    });

    it('should set title attribute from template description', () => {
      component.templates = MOCK_TEMPLATES;
      initDesktop();
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      expect(buttons[0].getAttribute('title')).toBe('A classic layout');
    });

    it('should emit templateSelect when a template button is clicked', () => {
      component.templates = MOCK_TEMPLATES;
      initDesktop();
      spyOn(component.templateSelect, 'emit');
      const buttons = fixture.nativeElement.querySelectorAll('.template-btn');
      buttons[1].click();
      expect(component.templateSelect.emit).toHaveBeenCalledWith('maze');
    });
  });

  describe('template rendering (mobile)', () => {
    /** Run ngOnInit first, then force mobile mode open */
    function initMobile(): void {
      fixture.detectChanges(); // triggers ngOnInit → checkMobile
      component.isMobile = true;
      component.isCollapsed = false;
      fixture.detectChanges();
    }

    it('should render a template select dropdown when templates are provided', () => {
      component.templates = MOCK_TEMPLATES;
      initMobile();
      const select = fixture.nativeElement.querySelector('.template-select') as HTMLSelectElement;
      expect(select).toBeTruthy();
      expect(select!.options.length).toBe(3);
      expect(select!.options[1].textContent!.trim()).toBe('Classic');
      expect(select!.options[2].textContent!.trim()).toBe('Maze');
    });

    it('should not render template select when templates is empty', () => {
      component.templates = [];
      initMobile();
      const select = fixture.nativeElement.querySelector('.template-select');
      expect(select).toBeNull();
    });

    it('should emit templateSelect when a template option is selected', () => {
      component.templates = MOCK_TEMPLATES;
      initMobile();
      spyOn(component.templateSelect, 'emit');
      const select = fixture.nativeElement.querySelector('.template-select') as HTMLSelectElement;
      select.value = 'maze';
      select.dispatchEvent(new Event('change'));
      expect(component.templateSelect.emit).toHaveBeenCalledWith('maze');
    });

    it('should render mobile header with play button and close button', () => {
      initMobile();
      const header = fixture.nativeElement.querySelector('.mobile-header');
      expect(header).toBeTruthy();
      expect(header.querySelector('.mobile-play-btn')).toBeTruthy();
      expect(header.querySelector('.mobile-close-btn')).toBeTruthy();
    });

    it('should render chip buttons for modes instead of mode-button', () => {
      initMobile();
      const chips = fixture.nativeElement.querySelectorAll('.chip');
      expect(chips.length).toBeGreaterThan(0);
      expect(fixture.nativeElement.querySelector('.mode-button')).toBeNull();
    });

    it('should not render shortcuts tab', () => {
      initMobile();
      expect(fixture.nativeElement.querySelector('.shortcuts-tab')).toBeNull();
      expect(fixture.nativeElement.querySelector('.tab-navigation')).toBeNull();
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

  describe('onTemplateSelect', () => {
    it('should emit templateSelect from select element change', () => {
      spyOn(component.templateSelect, 'emit');
      const mockEvent = { target: { value: 'classic' } } as unknown as Event;
      component.onTemplateSelect(mockEvent);
      expect(component.templateSelect.emit).toHaveBeenCalledWith('classic');
    });

    it('should not emit when value is empty', () => {
      spyOn(component.templateSelect, 'emit');
      const mockEvent = { target: { value: '' } } as unknown as Event;
      component.onTemplateSelect(mockEvent);
      expect(component.templateSelect.emit).not.toHaveBeenCalled();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { EditorModalService } from './editor-modal.service';

describe('EditorModalService', () => {
  let service: EditorModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorModalService] });
    service = TestBed.inject(EditorModalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('should start with showModal false', () => {
    expect(service.showModal).toBe(false);
  });

  it('should start with empty title and options', () => {
    expect(service.modalTitle).toBe('');
    expect(service.modalSelectOptions).toEqual([]);
  });

  // ── showInputModal ────────────────────────────────────────────────────────

  describe('showInputModal', () => {
    it('should open the modal with input type and default value', () => {
      service.showInputModal('Enter name', 'default', () => {});
      expect(service.showModal).toBe(true);
      expect(service.modalType).toBe('input');
      expect(service.modalTitle).toBe('Enter name');
      expect(service.modalInputValue).toBe('default');
    });

    it('should call callback with input value on confirmModal', () => {
      let result: string | null | undefined;
      service.showInputModal('Title', '', (v) => { result = v; });
      service.modalInputValue = 'my-map';
      service.confirmModal();
      expect(result).toBe('my-map');
    });

    it('should call callback with null on cancelModal', () => {
      let result: string | null | undefined;
      service.showInputModal('Title', '', (v) => { result = v; });
      service.cancelModal();
      expect(result).toBeNull();
    });

    it('should call callback with null when input value is empty on confirm', () => {
      let result: string | null | undefined;
      service.showInputModal('Title', '', (v) => { result = v; });
      service.modalInputValue = '';
      service.confirmModal();
      expect(result).toBeNull();
    });
  });

  // ── showConfirmModal ───────────────────────────────────────────────────────

  describe('showConfirmModal', () => {
    it('should open the modal with confirm type', () => {
      service.showConfirmModal('Are you sure?', () => {});
      expect(service.showModal).toBe(true);
      expect(service.modalType).toBe('confirm');
      expect(service.modalTitle).toBe('Are you sure?');
    });

    it('should call callback with true on confirmModal', () => {
      let result: boolean | undefined;
      service.showConfirmModal('Continue?', (v) => { result = v; });
      service.confirmModal();
      expect(result).toBe(true);
    });

    it('should call callback with false on cancelModal', () => {
      let result: boolean | undefined;
      service.showConfirmModal('Continue?', (v) => { result = v; });
      service.cancelModal();
      expect(result).toBe(false);
    });
  });

  // ── showSelectModal ────────────────────────────────────────────────────────

  describe('showSelectModal', () => {
    const options = ['Map A', 'Map B', 'Map C'];

    it('should open the modal with select type and options', () => {
      service.showSelectModal('Pick a map', options, () => {});
      expect(service.showModal).toBe(true);
      expect(service.modalType).toBe('select');
      expect(service.modalTitle).toBe('Pick a map');
      expect(service.modalSelectOptions).toEqual(options);
    });

    it('should call callback with selected index on selectModalOption', () => {
      let result: number | null | undefined;
      service.showSelectModal('Pick', options, (i) => { result = i; });
      service.selectModalOption(1);
      expect(result).toBe(1);
    });

    it('should call callback with index 0 when first option is selected', () => {
      let result: number | null | undefined;
      service.showSelectModal('Pick', options, (i) => { result = i; });
      service.selectModalOption(0);
      expect(result).toBe(0);
    });

    it('should call callback on cancelModal', () => {
      let called = false;
      service.showSelectModal('Pick', options, () => { called = true; });
      service.cancelModal();
      expect(called).toBe(true);
    });
  });

  // ── closeModal ────────────────────────────────────────────────────────────

  describe('closeModal', () => {
    it('should set showModal to false', () => {
      service.showConfirmModal('Confirm?', () => {});
      service.closeModal();
      expect(service.showModal).toBe(false);
    });

    it('should not invoke callback when closed directly', () => {
      let called = false;
      service.showConfirmModal('Confirm?', () => { called = true; });
      service.closeModal();
      expect(called).toBe(false);
    });
  });

  // ── State reset after close ───────────────────────────────────────────────

  it('should close modal after confirmModal is called', () => {
    service.showConfirmModal('Confirm?', () => {});
    service.confirmModal();
    expect(service.showModal).toBe(false);
  });

  it('should close modal after cancelModal is called', () => {
    service.showInputModal('Title', 'val', () => {});
    service.cancelModal();
    expect(service.showModal).toBe(false);
  });

  it('should close modal after selectModalOption is called', () => {
    service.showSelectModal('Pick', ['A', 'B'], () => {});
    service.selectModalOption(0);
    expect(service.showModal).toBe(false);
  });
});

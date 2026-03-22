import { FocusTrap } from './focus-trap.util';

function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  return btn;
}

function makeTrap(...children: HTMLElement[]): HTMLElement {
  const container = document.createElement('div');
  children.forEach(c => container.appendChild(c));
  document.body.appendChild(container);
  return container;
}

describe('FocusTrap', () => {
  let trap: FocusTrap;
  let container: HTMLElement;

  afterEach(() => {
    trap.deactivate();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  beforeEach(() => {
    trap = new FocusTrap();
  });

  describe('activate()', () => {
    it('should focus the first focusable element', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Second');
      container = makeTrap(btn1, btn2);

      trap.activate(container);

      expect(document.activeElement).toBe(btn1);
    });

    it('should save the previously focused element', () => {
      const outside = makeButton('Outside');
      document.body.appendChild(outside);
      outside.focus();

      const btn = makeButton('Inside');
      container = makeTrap(btn);
      trap.activate(container);

      // Deactivate returns focus to outside
      trap.deactivate();
      expect(document.activeElement).toBe(outside);

      document.body.removeChild(outside);
    });

    it('should handle empty trap without throwing', () => {
      container = makeTrap();
      expect(() => trap.activate(container)).not.toThrow();
    });
  });

  describe('deactivate()', () => {
    it('should restore focus to previously focused element', () => {
      const outside = makeButton('Outside');
      document.body.appendChild(outside);
      outside.focus();

      const btn = makeButton('Inside');
      container = makeTrap(btn);
      trap.activate(container);

      trap.deactivate();

      expect(document.activeElement).toBe(outside);
      document.body.removeChild(outside);
    });

    it('should remove the keydown listener so Tab is no longer intercepted', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Last');
      container = makeTrap(btn1, btn2);
      trap.activate(container);

      trap.deactivate();

      // Dispatch Tab from btn2 — should NOT wrap back to btn1
      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const prevented = spyOn(tabEvent, 'preventDefault');
      document.dispatchEvent(tabEvent);

      expect(prevented).not.toHaveBeenCalled();
    });

    it('should be safe to call when not active', () => {
      trap = new FocusTrap();
      expect(() => trap.deactivate()).not.toThrow();
    });
  });

  describe('Tab key wrapping', () => {
    it('should wrap focus from last to first on Tab', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Last');
      container = makeTrap(btn1, btn2);
      trap.activate(container);

      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);

      expect(document.activeElement).toBe(btn1);
    });

    it('should wrap focus from first to last on Shift+Tab', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Last');
      container = makeTrap(btn1, btn2);
      trap.activate(container);

      btn1.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(shiftTabEvent);

      expect(document.activeElement).toBe(btn2);
    });

    it('should call preventDefault when wrapping', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Last');
      container = makeTrap(btn1, btn2);
      trap.activate(container);

      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      spyOn(tabEvent, 'preventDefault');
      document.dispatchEvent(tabEvent);

      expect(tabEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not preventDefault when tabbing between middle elements', () => {
      const btn1 = makeButton('First');
      const btn2 = makeButton('Middle');
      const btn3 = makeButton('Last');
      container = makeTrap(btn1, btn2, btn3);
      trap.activate(container);

      btn2.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      spyOn(tabEvent, 'preventDefault');
      document.dispatchEvent(tabEvent);

      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('non-Tab keys', () => {
    it('should ignore non-Tab keydown events', () => {
      const btn1 = makeButton('First');
      container = makeTrap(btn1);
      trap.activate(container);

      btn1.focus();
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      spyOn(enterEvent, 'preventDefault');
      document.dispatchEvent(enterEvent);

      expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should ignore Escape key', () => {
      const btn1 = makeButton('First');
      container = makeTrap(btn1);
      trap.activate(container);

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      spyOn(escEvent, 'preventDefault');
      document.dispatchEvent(escEvent);

      expect(escEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('empty trap', () => {
    it('should not throw when Tab is pressed in empty trap', () => {
      container = makeTrap();
      trap.activate(container);

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      expect(() => document.dispatchEvent(tabEvent)).not.toThrow();
    });
  });
});

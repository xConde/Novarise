import { Injectable } from '@angular/core';

export type ModalType = 'input' | 'confirm' | 'select';

/**
 * Manages the in-editor modal dialog state (replaces browser prompt/confirm).
 * The component binds its template to the public fields exposed here.
 */
@Injectable()
export class EditorModalService {
  public showModal = false;
  public modalTitle = '';
  public modalType: ModalType = 'confirm';
  public modalInputValue = '';
  public modalSelectOptions: string[] = [];

  private modalCallback: ((result: string | boolean | number | null) => void) | null = null;

  // ── Show helpers ───────────────────────────────────────────────────────────

  showInputModal(title: string, defaultValue: string, callback: (value: string | null) => void): void {
    this.modalTitle = title;
    this.modalType = 'input';
    this.modalInputValue = defaultValue;
    this.modalCallback = (result) => callback(result as string | null);
    this.showModal = true;
  }

  showConfirmModal(title: string, callback: (confirmed: boolean) => void): void {
    this.modalTitle = title;
    this.modalType = 'confirm';
    this.modalCallback = (result) => callback(result as boolean);
    this.showModal = true;
  }

  showSelectModal(title: string, options: string[], callback: (index: number | null) => void): void {
    this.modalTitle = title;
    this.modalType = 'select';
    this.modalSelectOptions = options;
    this.modalCallback = (result) => callback(result === null ? null : (result as unknown as number));
    this.showModal = true;
  }

  // ── User actions (called from template) ───────────────────────────────────

  confirmModal(): void {
    const cb = this.modalCallback;
    const value = this.modalType === 'input' ? (this.modalInputValue || null) : true;
    this.closeModal();
    if (cb) cb(value);
  }

  selectModalOption(index: number): void {
    const cb = this.modalCallback;
    this.closeModal();
    if (cb) cb(index);
  }

  cancelModal(): void {
    const cb = this.modalCallback;
    const value = this.modalType === 'input' ? null : false;
    this.closeModal();
    if (cb) cb(value);
  }

  closeModal(): void {
    this.showModal = false;
    this.modalCallback = null;
  }
}

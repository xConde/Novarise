import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  JoystickType,
  JoystickPosition,
  JoystickVector,
  JoystickEvent,
  JOYSTICK_SIZES
} from '../../models/joystick.types';
import { TouchDetectionService, DeviceInfo } from '../../services/touch-detection.service';

@Component({
  selector: 'app-virtual-joystick',
  templateUrl: './virtual-joystick.component.html',
  styleUrls: ['./virtual-joystick.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualJoystickComponent implements OnInit, OnDestroy {
  @ViewChild('joystickBase') joystickBase!: ElementRef<HTMLDivElement>;
  @ViewChild('joystickStick') joystickStick!: ElementRef<HTMLDivElement>;

  @Input() type: JoystickType = 'movement';
  @Input() position: JoystickPosition = 'left';
  @Input() sensitivity = 1.0;

  @Output() joystickChange = new EventEmitter<JoystickEvent>();

  // State
  isActive = false;
  isVisible = false;
  vector: JoystickVector = { x: 0, y: 0 };
  stickTransform = 'translate(-50%, -50%)';

  // Sizing (responsive) - explicitly typed as number to allow dynamic assignment
  baseSize: number = JOYSTICK_SIZES.MOBILE_PORTRAIT.base;
  stickSize: number = JOYSTICK_SIZES.MOBILE_PORTRAIT.stick;
  maxDistance: number = JOYSTICK_SIZES.MOBILE_PORTRAIT.maxDistance;

  private subscription?: Subscription;
  private touchStartHandler?: (e: TouchEvent) => void;
  private touchMoveHandler?: (e: TouchEvent) => void;
  private touchEndHandler?: () => void;

  constructor(
    private touchDetection: TouchDetectionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.touchDetection.getDeviceInfo().subscribe(info => {
      this.updateForDevice(info);
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.setupTouchListeners();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.removeTouchListeners();
  }

  private updateForDevice(info: DeviceInfo): void {
    this.isVisible = info.showVirtualControls;

    // Update sizes based on device type and orientation
    if (info.deviceType === 'tablet') {
      this.baseSize = JOYSTICK_SIZES.TABLET.base;
      this.stickSize = JOYSTICK_SIZES.TABLET.stick;
      this.maxDistance = JOYSTICK_SIZES.TABLET.maxDistance;
    } else if (info.orientation === 'landscape') {
      this.baseSize = JOYSTICK_SIZES.MOBILE_LANDSCAPE.base;
      this.stickSize = JOYSTICK_SIZES.MOBILE_LANDSCAPE.stick;
      this.maxDistance = JOYSTICK_SIZES.MOBILE_LANDSCAPE.maxDistance;
    } else {
      this.baseSize = JOYSTICK_SIZES.MOBILE_PORTRAIT.base;
      this.stickSize = JOYSTICK_SIZES.MOBILE_PORTRAIT.stick;
      this.maxDistance = JOYSTICK_SIZES.MOBILE_PORTRAIT.maxDistance;
    }
  }

  private setupTouchListeners(): void {
    if (!this.joystickBase?.nativeElement) return;

    const baseElement = this.joystickBase.nativeElement;

    this.touchStartHandler = (event: TouchEvent) => {
      event.preventDefault();
      this.isActive = true;
      // Apply scale on activation (centered position with scale)
      this.stickTransform = 'translate(-50%, -50%) scale(1.1)';
      this.emitChange();
      this.cdr.markForCheck();
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      if (!this.isActive) return;
      event.preventDefault();

      const touch = event.touches[0];
      const rect = baseElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let deltaX = touch.clientX - centerX;
      let deltaY = touch.clientY - centerY;

      // Clamp to max distance
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > this.maxDistance) {
        deltaX = (deltaX / distance) * this.maxDistance;
        deltaY = (deltaY / distance) * this.maxDistance;
      }

      // Normalize to -1 to 1 range and apply sensitivity
      this.vector.x = (deltaX / this.maxDistance) * this.sensitivity;
      this.vector.y = (-deltaY / this.maxDistance) * this.sensitivity; // Invert Y

      // Update visual position with scale effect while active
      this.stickTransform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(1.1)`;

      this.emitChange();
      this.cdr.markForCheck();
    };

    this.touchEndHandler = () => {
      this.isActive = false;
      this.vector = { x: 0, y: 0 };
      this.stickTransform = 'translate(-50%, -50%)';
      this.emitChange();
      this.cdr.markForCheck();
    };

    baseElement.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    baseElement.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    baseElement.addEventListener('touchend', this.touchEndHandler);
    baseElement.addEventListener('touchcancel', this.touchEndHandler);
  }

  private removeTouchListeners(): void {
    if (!this.joystickBase?.nativeElement) return;

    const baseElement = this.joystickBase.nativeElement;

    if (this.touchStartHandler) {
      baseElement.removeEventListener('touchstart', this.touchStartHandler);
    }
    if (this.touchMoveHandler) {
      baseElement.removeEventListener('touchmove', this.touchMoveHandler);
    }
    if (this.touchEndHandler) {
      baseElement.removeEventListener('touchend', this.touchEndHandler);
      baseElement.removeEventListener('touchcancel', this.touchEndHandler);
    }
  }

  private emitChange(): void {
    this.joystickChange.emit({
      type: this.type,
      vector: { ...this.vector },
      active: this.isActive
    });
  }
}

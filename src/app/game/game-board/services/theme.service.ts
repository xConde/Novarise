/**
 * Theme Service
 *
 * Manages theme loading, validation, and application with comprehensive error handling.
 * Provides a robust system for switching between visual themes while maintaining
 * game state integrity.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  ThemeConfig,
  ThemePreset,
  ThemeOperationResult,
  ThemeValidationResult,
  THEME_PRESETS,
  DEFAULT_THEME,
  validateThemeConfig
} from '../models/theme.model';
import { TerrainType, TerrainProperties, TERRAIN_CONFIG } from '../models/terrain.model';

/**
 * Service for managing game themes and visual loadouts.
 * Implements proper error handling and state management.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  /** Current active theme */
  private currentThemeSubject = new BehaviorSubject<ThemeConfig>(DEFAULT_THEME);

  /** Observable for components to subscribe to theme changes */
  public currentTheme$: Observable<ThemeConfig> = this.currentThemeSubject.asObservable();

  /** Cache of loaded custom themes */
  private customThemes: Map<string, ThemeConfig> = new Map();

  /** History of theme changes for undo functionality */
  private themeHistory: ThemeConfig[] = [DEFAULT_THEME];

  /** Maximum history size to prevent memory issues */
  private readonly MAX_HISTORY_SIZE = 10;

  constructor() {
    this.initializeThemeService();
  }

  /**
   * Initialize the theme service with default settings.
   * Loads any saved theme preferences from local storage.
   */
  private initializeThemeService(): void {
    try {
      const savedThemeId = this.loadThemePreference();
      if (savedThemeId) {
        const result = this.loadTheme(savedThemeId as ThemePreset);
        if (!result.success) {
          console.warn('Failed to load saved theme, using default:', result.error);
          this.saveThemePreference(DEFAULT_THEME.id);
        }
      }
    } catch (error) {
      console.error('Error initializing theme service:', error);
      // Ensure we have a valid theme even if initialization fails
      this.currentThemeSubject.next(DEFAULT_THEME);
    }
  }

  /**
   * Get the currently active theme.
   */
  getCurrentTheme(): ThemeConfig {
    return this.currentThemeSubject.value;
  }

  /**
   * Load and apply a theme by preset ID.
   *
   * @param preset The theme preset to load
   * @returns Result indicating success or failure with details
   */
  loadTheme(preset: ThemePreset): ThemeOperationResult {
    try {
      // Validate preset exists
      if (!THEME_PRESETS[preset]) {
        return {
          success: false,
          error: `Theme preset not found: ${preset}`,
          errorDetails: { availablePresets: Object.keys(THEME_PRESETS) }
        };
      }

      const theme = THEME_PRESETS[preset];

      // Validate theme configuration
      const validation = validateThemeConfig(theme);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Theme validation failed',
          errorDetails: { validationErrors: validation.errors }
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Theme validation warnings:', validation.warnings);
      }

      // Apply the theme
      this.applyTheme(theme);

      // Save preference
      this.saveThemePreference(preset);

      return {
        success: true,
        theme
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unexpected error loading theme',
        errorDetails: error
      };
    }
  }

  /**
   * Load a custom theme configuration.
   *
   * @param themeConfig Custom theme configuration
   * @returns Result indicating success or failure
   */
  loadCustomTheme(themeConfig: ThemeConfig): ThemeOperationResult {
    try {
      // Validate the custom theme
      const validation = validateThemeConfig(themeConfig);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Custom theme validation failed',
          errorDetails: { validationErrors: validation.errors }
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Custom theme validation warnings:', validation.warnings);
      }

      // Cache the custom theme
      this.customThemes.set(themeConfig.id, themeConfig);

      // Apply the theme
      this.applyTheme(themeConfig);

      return {
        success: true,
        theme: themeConfig
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unexpected error loading custom theme',
        errorDetails: error
      };
    }
  }

  /**
   * Apply a theme to the current game state.
   * Updates the current theme subject and manages history.
   *
   * @param theme The theme to apply
   */
  private applyTheme(theme: ThemeConfig): void {
    // Add to history
    this.themeHistory.push(theme);

    // Trim history if needed
    if (this.themeHistory.length > this.MAX_HISTORY_SIZE) {
      this.themeHistory.shift();
    }

    // Update current theme
    this.currentThemeSubject.next(theme);
  }

  /**
   * Revert to the previous theme in history.
   *
   * @returns Result indicating success or failure
   */
  undoThemeChange(): ThemeOperationResult {
    if (this.themeHistory.length <= 1) {
      return {
        success: false,
        error: 'No previous theme to revert to'
      };
    }

    try {
      // Remove current theme
      this.themeHistory.pop();

      // Get previous theme
      const previousTheme = this.themeHistory[this.themeHistory.length - 1];

      // Apply it without adding to history again
      this.currentThemeSubject.next(previousTheme);

      return {
        success: true,
        theme: previousTheme
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error reverting to previous theme',
        errorDetails: error
      };
    }
  }

  /**
   * Get all available theme presets.
   */
  getAvailableThemes(): ThemeConfig[] {
    return Object.values(THEME_PRESETS);
  }

  /**
   * Get all custom themes that have been loaded.
   */
  getCustomThemes(): ThemeConfig[] {
    return Array.from(this.customThemes.values());
  }

  /**
   * Get terrain properties with theme overrides applied.
   *
   * @param terrainType The terrain type to get properties for
   * @param theme Optional theme to use (defaults to current theme)
   * @returns Terrain properties with theme-specific overrides
   */
  getThemedTerrainProperties(
    terrainType: TerrainType,
    theme?: ThemeConfig
  ): TerrainProperties {
    const activeTheme = theme || this.getCurrentTheme();
    const baseProperties = { ...TERRAIN_CONFIG[terrainType] };

    // Apply theme overrides if they exist
    if (activeTheme.terrainOverrides && activeTheme.terrainOverrides[terrainType]) {
      const overrides = activeTheme.terrainOverrides[terrainType];
      return { ...baseProperties, ...overrides };
    }

    return baseProperties;
  }

  /**
   * Validate a theme configuration without applying it.
   *
   * @param theme The theme to validate
   * @returns Validation result with errors and warnings
   */
  validateTheme(theme: ThemeConfig): ThemeValidationResult {
    return validateThemeConfig(theme);
  }

  /**
   * Export current theme as JSON for sharing or backup.
   *
   * @returns JSON string of current theme
   */
  exportCurrentTheme(): string {
    return JSON.stringify(this.getCurrentTheme(), null, 2);
  }

  /**
   * Import a theme from JSON string.
   *
   * @param jsonString JSON representation of a theme
   * @returns Result indicating success or failure
   */
  importTheme(jsonString: string): ThemeOperationResult {
    try {
      const theme = JSON.parse(jsonString) as ThemeConfig;

      // Validate the imported theme
      const validation = validateThemeConfig(theme);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Imported theme is invalid',
          errorDetails: { validationErrors: validation.errors }
        };
      }

      // Load as custom theme
      return this.loadCustomTheme(theme);
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse theme JSON',
        errorDetails: error
      };
    }
  }

  /**
   * Reset to default theme.
   */
  resetToDefault(): void {
    this.applyTheme(DEFAULT_THEME);
    this.saveThemePreference(DEFAULT_THEME.id);
  }

  /**
   * Save theme preference to local storage.
   *
   * @param themeId The theme ID to save
   */
  private saveThemePreference(themeId: string): void {
    try {
      localStorage.setItem('novarise_theme_preference', themeId);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  /**
   * Load theme preference from local storage.
   *
   * @returns Saved theme ID or null
   */
  private loadThemePreference(): string | null {
    try {
      return localStorage.getItem('novarise_theme_preference');
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      return null;
    }
  }

  /**
   * Clear all custom themes from cache.
   */
  clearCustomThemes(): void {
    this.customThemes.clear();
  }

  /**
   * Get theme history for debugging or UI display.
   */
  getThemeHistory(): ThemeConfig[] {
    return [...this.themeHistory];
  }
}

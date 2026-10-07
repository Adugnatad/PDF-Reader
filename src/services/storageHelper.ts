/**
 * Storage Helper (Web Platform)
 * Uses window.localStorage for persistent document metadata and reader settings
 */
import { ViewModeSettings } from '../types';

export const DEFAULT_VIEW_SETTINGS: ViewModeSettings = {
  viewMode: 'single',
  reflow: false,
  reflowFontSize: 16,
  theme: 'sepia',
  readingDirection: 'vertical',
};

export async function saveRegistryToDisk(payload: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('docuflow_saved_registry', payload);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }
}

export async function loadRegistryFromDisk(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem('docuflow_saved_registry');
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
  }
  return null;
}

export async function saveViewModeSettings(settings: ViewModeSettings): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('docuflow_view_mode_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage save view mode error:', e);
    }
  }
}

export async function loadViewModeSettings(): Promise<ViewModeSettings | null> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem('docuflow_view_mode_settings');
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...DEFAULT_VIEW_SETTINGS,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('LocalStorage read view mode error:', e);
    }
  }
  return null;
}

export async function saveThumbnailsToDisk(payload: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('docuflow_pdf_thumbnails', payload);
    } catch (e) {
      console.warn('LocalStorage save thumbnails error:', e);
    }
  }
}

export async function loadThumbnailsFromDisk(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem('docuflow_pdf_thumbnails');
    } catch (e) {
      console.warn('LocalStorage read thumbnails error:', e);
    }
  }
  return null;
}

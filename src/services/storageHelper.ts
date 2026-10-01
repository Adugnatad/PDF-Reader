/**
 * Storage Helper (Web Platform)
 * Uses window.localStorage for persistent document metadata
 */

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

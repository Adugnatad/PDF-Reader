// Web bridge for expo-screen-orientation
export enum Orientation {
  UNKNOWN = 0,
  PORTRAIT_UP = 1,
  PORTRAIT_DOWN = 2,
  LANDSCAPE_LEFT = 3,
  LANDSCAPE_RIGHT = 4,
}

export enum OrientationLock {
  DEFAULT = 0,
  ALL = 1,
  PORTRAIT = 2,
  PORTRAIT_UP = 3,
  PORTRAIT_DOWN = 4,
  LANDSCAPE = 5,
  LANDSCAPE_LEFT = 6,
  LANDSCAPE_RIGHT = 7,
  OTHER = 8,
}

export async function lockAsync(orientationLock: OrientationLock): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    'screen' in window &&
    'orientation' in (window.screen as any) &&
    (window.screen.orientation as any)?.lock
  ) {
    try {
      const isLandscape =
        orientationLock === OrientationLock.LANDSCAPE ||
        orientationLock === OrientationLock.LANDSCAPE_LEFT ||
        orientationLock === OrientationLock.LANDSCAPE_RIGHT;
      await (window.screen.orientation as any)
        .lock(isLandscape ? 'landscape' : 'portrait')
        .catch(() => {});
    } catch {}
  }
}

export async function unlockAsync(): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    'screen' in window &&
    'orientation' in (window.screen as any) &&
    (window.screen.orientation as any)?.unlock
  ) {
    try {
      (window.screen.orientation as any).unlock();
    } catch {}
  }
}

export async function getOrientationAsync(): Promise<Orientation> {
  return Orientation.PORTRAIT_UP;
}

export function addOrientationChangeListener(_listener: any): any {
  return { remove: () => {} };
}

export function removeOrientationChangeListener(_subscription: any): void {}

export default {
  Orientation,
  OrientationLock,
  lockAsync,
  unlockAsync,
  getOrientationAsync,
  addOrientationChangeListener,
  removeOrientationChangeListener,
};

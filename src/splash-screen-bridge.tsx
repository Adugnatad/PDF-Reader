// Web bridge for expo-splash-screen
export async function preventAutoHideAsync(): Promise<boolean> {
  return false;
}

export function setOptions(_options: any): void {}

export function hide(): void {}

export async function hideAsync(): Promise<boolean> {
  return true;
}

export default {
  preventAutoHideAsync,
  setOptions,
  hide,
  hideAsync,
};

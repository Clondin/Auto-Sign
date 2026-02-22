export function isDesktop(): boolean {
  try {
    return !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
}

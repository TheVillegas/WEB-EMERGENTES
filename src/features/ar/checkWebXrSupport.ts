export async function checkWebXrSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.xr?.isSessionSupported) {
    return false;
  }

  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

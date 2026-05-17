export async function isImmersiveArSupported(): Promise<boolean> {
  if (!navigator.xr?.isSessionSupported) {
    return false;
  }

  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

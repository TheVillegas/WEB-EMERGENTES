import { createXRStore } from '@react-three/xr';

export const battleXrStore = createXRStore({
  hand: false,
  controller: false,
  gaze: false,
  screenInput: true,
  transientPointer: true,
});

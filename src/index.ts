import { parseBridgeOptions } from './config';
import { startBridge } from './server';

if (require.main === module) {
  const config = parseBridgeOptions();
  startBridge(config);
}

export { startBridge } from './server';
export { parseBridgeOptions } from './config';
export { buildFreeDPacket, clamp, packAngle, packPosition, packZoom, parseHlaeData, writeInt24BEClamped } from './packet';
export type { BridgeOptions, HlaeCameraData } from './types';

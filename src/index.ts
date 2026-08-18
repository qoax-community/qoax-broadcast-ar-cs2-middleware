import { isHelpRequested, parseBridgeOptions, USAGE } from './config';
import { startBridge } from './server';

function main(): void {
  if (isHelpRequested()) {
    console.log(USAGE);
    return;
  }

  const config = parseBridgeOptions();
  startBridge(config);
}

if (require.main === module) {
  main();
}

export { startBridge } from './server';
export { isHelpRequested, parseBridgeOptions, USAGE } from './config';
export { buildFreeDPacket, clamp, packAngle, packPosition, packZoom, parseHlaeData, writeInt24BEClamped } from './packet';
export type { BridgeOptions, HlaeCameraData } from './types';

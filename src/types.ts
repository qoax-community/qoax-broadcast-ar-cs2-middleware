export interface HlaeCameraData {
  yaw: number;
  pitch: number;
  roll: number;
  x: number;
  y: number;
  z: number;
  fov?: number;
}

export interface BridgeOptions {
  unrealHost: string;
  unrealPort: number;
  websocketHost: string;
  websocketPort: number;
}

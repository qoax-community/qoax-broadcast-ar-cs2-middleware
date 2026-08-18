import { HlaeCameraData } from './types';

const MAX_INT24 = 8_388_607;
const MIN_INT24 = -8_388_608;
const FREE_D_MESSAGE_TYPE = 0xd1;
const FREE_D_CAMERA_ID = 0xff;
const FREE_D_PACKET_LENGTH = 29;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseHlaeData(raw: unknown): HlaeCameraData | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const { yaw, pitch, roll, x, y, z, fov } = record;

  if (
    !isFiniteNumber(yaw) ||
    !isFiniteNumber(pitch) ||
    !isFiniteNumber(roll) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(z) ||
    (fov !== undefined && !isFiniteNumber(fov))
  ) {
    return null;
  }

  return {
    yaw,
    pitch,
    roll,
    x,
    y,
    z,
    fov: fov ?? 90,
  };
}

export function writeInt24BEClamped(buffer: Buffer, offset: number, value: number): void {
  const bounded = clamp(value, MIN_INT24, MAX_INT24);
  buffer.writeIntBE(bounded, offset, 3);
}

export function packAngle(buffer: Buffer, offset: number, angle: number): void {
  const normalized = ((angle + 180) % 360 + 360) % 360 - 180;
  const scaled = Math.round(normalized * 32768);
  writeInt24BEClamped(buffer, offset, scaled);
}

export function packPosition(buffer: Buffer, offset: number, position: number): void {
  const scaled = Math.round(position * 256);
  writeInt24BEClamped(buffer, offset, scaled);
}

export function packZoom(buffer: Buffer, offset: number, fov: number): void {
  writeInt24BEClamped(buffer, offset, Math.round((fov ?? 90) * 256));
}

export function buildFreeDPacket(data: HlaeCameraData): Buffer {
  const buffer = Buffer.alloc(FREE_D_PACKET_LENGTH, 0x00);

  buffer.writeUInt8(FREE_D_MESSAGE_TYPE, 0);
  buffer.writeUInt8(FREE_D_CAMERA_ID, 1);

  packAngle(buffer, 2, data.yaw);
  packAngle(buffer, 5, data.pitch * -1);
  packAngle(buffer, 8, data.roll);

  packPosition(buffer, 11, data.y * 2.54);
  packPosition(buffer, 14, data.x * 2.54);
  packPosition(buffer, 17, data.z * 2.54);

  packZoom(buffer, 23, data.fov ?? 90);

  const checksum = 64 - buffer.subarray(0, 28).reduce((sum, byte) => sum + byte, 0);
  buffer.writeUInt8(checksum & 0xff, 28);

  return buffer;
}

export { FREE_D_MESSAGE_TYPE, FREE_D_CAMERA_ID, FREE_D_PACKET_LENGTH };

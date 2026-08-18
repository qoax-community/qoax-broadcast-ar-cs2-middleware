import dgram from 'node:dgram';
import WebSocket, { WebSocketServer } from 'ws';

const MAX_INT24 = 8_388_607;
const MIN_INT24 = -8_388_608;
const FREE_D_MESSAGE_TYPE = 0xd1;
const FREE_D_CAMERA_ID = 0xff;
const FREE_D_PACKET_LENGTH = 29;

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
  unrealIp: string;
  unrealPort: number;
  websocketPort: number;
  websocketHost: string;
}

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
  const yaw = record.yaw;
  const pitch = record.pitch;
  const roll = record.roll;
  const x = record.x;
  const y = record.y;
  const z = record.z;
  const fov = record.fov;

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
  const zoom = fov ?? 90;
  writeInt24BEClamped(buffer, offset, Math.round(zoom * 256));
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

export function startBridge(options: Partial<BridgeOptions> = {}): {
  udpClient: dgram.Socket;
  wss: WebSocketServer;
} {
  const config: BridgeOptions = {
    unrealIp: '192.168.3.177',
    unrealPort: 40_000,
    websocketPort: 3000,
    websocketHost: '127.0.0.1',
    ...options,
  };

  const udpClient = dgram.createSocket('udp4');
  const wss = new WebSocketServer({
    host: config.websocketHost,
    port: config.websocketPort,
  });

  wss.on('listening', () => {
    console.log(`Listening for HLAE connections on ws://${config.websocketHost}:${config.websocketPort}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('HLAE connected. Streaming camera data...');

    ws.on('message', (message: WebSocket.RawData) => {
      let payload: unknown;

      try {
        payload = JSON.parse(message.toString());
      } catch (error) {
        const messageError = error as Error;
        console.error('Failed to parse incoming HLAE data:', messageError.message);
        return;
      }

      const cameraData = parseHlaeData(payload);
      if (!cameraData) {
        console.error('Incoming HLAE data was missing required camera fields:', payload);
        return;
      }

      const packet = buildFreeDPacket(cameraData);
      udpClient.send(packet, 0, packet.length, config.unrealPort, config.unrealIp, (err) => {
        if (err) {
          console.error(`UDP send failed: ${err.message}`);
        }
      });
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('HLAE disconnected.');
    });
  });

  udpClient.on('error', (error: Error) => {
    console.error(`UDP client error:\n${error.stack ?? error.message}`);
    udpClient.close();
  });

  const shutdown = () => {
    wss.close(() => console.log('WebSocket server closed.'));
    udpClient.close(() => console.log('UDP socket closed.'));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { udpClient, wss };
}

if (require.main === module) {
  startBridge();
}

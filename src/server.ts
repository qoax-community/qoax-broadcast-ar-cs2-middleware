import dgram from 'node:dgram';
import WebSocket, { WebSocketServer } from 'ws';

import { buildFreeDPacket, parseHlaeData } from './packet';
import { DEFAULT_BRIDGE_OPTIONS } from './config';
import { BridgeOptions } from './types';

export function startBridge(options: Partial<BridgeOptions> = {}): {
  udpClient: dgram.Socket;
  wss: WebSocketServer;
} {
  const config: BridgeOptions = {
    ...DEFAULT_BRIDGE_OPTIONS,
    ...options,
  };

  const udpClient = dgram.createSocket('udp4');
  const wss = new WebSocketServer({
    host: config.websocketHost,
    port: config.websocketPort,
  });

  wss.on('listening', () => {
    console.log(`Listening for HLAE connections on ws://${config.websocketHost}:${config.websocketPort}`);
    console.log(`Forwarding FreeD packets to Unreal Engine at udp://${config.unrealHost}:${config.unrealPort}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('HLAE connected. Streaming camera data...');

    ws.on('message', (message: WebSocket.RawData) => {
      let payload: unknown;

      try {
        payload = JSON.parse(message.toString());
      } catch (error) {
        console.error('Failed to parse incoming HLAE data:', (error as Error).message);
        return;
      }

      const cameraData = parseHlaeData(payload);
      if (!cameraData) {
        console.error('Incoming HLAE data was missing required camera fields:', payload);
        return;
      }

      const packet = buildFreeDPacket(cameraData);
      udpClient.send(packet, 0, packet.length, config.unrealPort, config.unrealHost, (error) => {
        if (error) {
          console.error(`UDP send failed: ${error.message}`);
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

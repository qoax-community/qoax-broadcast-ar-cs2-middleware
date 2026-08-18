import { BridgeOptions } from './types';

export const DEFAULT_BRIDGE_OPTIONS: BridgeOptions = {
  unrealHost: '127.0.0.1',
  unrealPort: 40_000,
  websocketHost: '127.0.0.1',
  websocketPort: 3000,
};

function getFlagValue(args: Map<string, string>, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const value = args.get(candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseAddress(value: string | undefined, fallbackHost: string, fallbackPort: number): { host: string; port: number } {
  if (!value) {
    return { host: fallbackHost, port: fallbackPort };
  }

  const trimmed = value.trim();

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `tcp://${trimmed}`);
    const port = Number.parseInt(url.port || String(fallbackPort), 10);

    return {
      host: url.hostname,
      port: Number.isFinite(port) ? port : fallbackPort,
    };
  } catch {
    const [host, portText] = trimmed.split(':');
    if (host && portText !== undefined) {
      return {
        host,
        port: parseInteger(portText, fallbackPort),
      };
    }

    return { host: trimmed || fallbackHost, port: fallbackPort };
  }
}

export function parseBridgeOptions(args: string[] = process.argv.slice(2)): BridgeOptions {
  const flags = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      index += 1;
      continue;
    }

    flags.set(key, 'true');
  }

  const unrealAddress = getFlagValue(flags, ['unreal-address', 'unreal-ip', 'unreal-host']);
  const websocketAddress = getFlagValue(flags, ['websocket-address', 'websocket-host', 'ws-address', 'ws-host']);

  const unrealConfig = parseAddress(unrealAddress, DEFAULT_BRIDGE_OPTIONS.unrealHost, DEFAULT_BRIDGE_OPTIONS.unrealPort);
  const websocketConfig = parseAddress(websocketAddress, DEFAULT_BRIDGE_OPTIONS.websocketHost, DEFAULT_BRIDGE_OPTIONS.websocketPort);

  const parsedOptions: BridgeOptions = {
    ...DEFAULT_BRIDGE_OPTIONS,
    unrealHost: unrealConfig.host,
    unrealPort: parseInteger(getFlagValue(flags, ['unreal-port']), unrealConfig.port),
    websocketHost: websocketConfig.host,
    websocketPort: parseInteger(getFlagValue(flags, ['websocket-port', 'ws-port']), websocketConfig.port),
  };

  if (getFlagValue(flags, ['help', 'h']) !== undefined) {
    console.log('Usage: node dist/index.js [--unreal-host 127.0.0.1] [--unreal-port 40000] [--websocket-host 127.0.0.1] [--websocket-port 3000] [--unreal-address 127.0.0.1:40000] [--websocket-address ws://127.0.0.1:3000]');
  }

  return parsedOptions;
}

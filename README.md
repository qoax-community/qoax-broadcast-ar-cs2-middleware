# qoax-broadcast-ar-cs2-middleware

Middleware that receives CS2 HLAE camera data over WebSocket, converts it into a
[FreeD](https://en.wikipedia.org/wiki/FreeD) UDP packet, and forwards it to Unreal Engine 5's
Live Link so a virtual/AR camera can follow the in-game spectator camera in real time.

## How it works

```mermaid
flowchart LR
    HLAE[HLAE / CS2] -- JSON over WebSocket --> Bridge[qoax-broadcast-ar-cs2-middleware]
    Bridge -- FreeD packet over UDP --> Unreal[Unreal Engine 5 Live Link]
```

1. HLAE connects to the local WebSocket server and streams camera data (`yaw`, `pitch`, `roll`,
   `x`, `y`, `z`, `fov`) as JSON messages.
2. The middleware validates and converts each message into a 29-byte FreeD packet.
3. The packet is sent over UDP to the configured Unreal Engine endpoint.

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

Compiles TypeScript from `src/` to `dist/`.

## Run

```bash
npm run start
```

Or run the compiled entry point directly:

```bash
node dist/index.js
```

For active development, `npm run dev` runs the TypeScript compiler in watch mode.

## Test

```bash
npm test
```

Builds the project and runs the unit tests (Node's built-in test runner) against the compiled
`dist/index.test.js`.

## CLI configuration

The middleware is a CLI tool and accepts flags to configure both endpoints. All flags are
optional; localhost defaults are used when a flag is omitted.

| Flag | Description | Default |
| --- | --- | --- |
| `--unreal-address <host:port>` | Combined Unreal Engine host and port | `127.0.0.1:40000` |
| `--unreal-host <host>` | Unreal Engine target host | `127.0.0.1` |
| `--unreal-port <port>` | Unreal Engine target UDP port | `40000` |
| `--websocket-address <host:port>` | Combined WebSocket bind host and port | `127.0.0.1:3000` |
| `--websocket-host <host>` | WebSocket server bind host | `127.0.0.1` |
| `--websocket-port <port>` | WebSocket server port | `3000` |
| `--help`, `-h` | Print usage information | |

Combined `--*-address` flags accept either `host:port` or a full URL such as
`ws://127.0.0.1:3000`. Individual `--*-host` / `--*-port` flags take precedence over the parsed
address when both are provided.

### Examples

Use defaults (everything on localhost):

```bash
node dist/index.js
```

Point to a specific Unreal Engine machine on the network:

```bash
node dist/index.js --unreal-address 192.168.3.177:40000
```

Expose the WebSocket listener on all network interfaces (e.g. HLAE runs on another machine):

```bash
node dist/index.js --websocket-host 0.0.0.0
```

### Notes on `websocket-host`

`websocket-host` controls which network interface the WebSocket server binds/listens on, not
where data is sent to:

- `127.0.0.1` (default) — only accepts connections from the same machine. Use this when HLAE and
  this middleware run on the same PC, which is the common case.
- `0.0.0.0` — accepts connections from any interface. Use this if HLAE runs on a different
  machine on the network.
- A specific LAN IP — restricts listening to just that network interface.

If HLAE always runs on the same machine as this middleware, you can safely ignore this flag and
rely on the default.

## Project structure

```
src/
  index.ts        CLI entry point: parses flags and starts the bridge
  config.ts       CLI argument parsing and default configuration
  server.ts       WebSocket + UDP bridge runtime
  packet.ts       HLAE payload validation and FreeD packet packing
  types.ts        Shared TypeScript types
  index.test.ts   Unit tests
```

## FreeD packet format

Each packet is 29 bytes:

| Bytes | Field |
| --- | --- |
| 0 | Message type (`0xD1`) |
| 1 | Camera ID (`0xFF`) |
| 2-4 | Yaw |
| 5-7 | Pitch (inverted) |
| 8-10 | Roll |
| 11-13 | Y position (converted from inches to cm) |
| 14-16 | X position (converted from inches to cm) |
| 17-19 | Z position (converted from inches to cm) |
| 20-22 | Reserved (zoom, unused) |
| 23-25 | FOV |
| 26-27 | Reserved |
| 28 | Checksum |
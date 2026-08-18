import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeDPacket,
  clamp,
  parseHlaeData,
  packAngle,
  packPosition,
  packZoom,
  writeInt24BEClamped,
} from './index';

test('clamp keeps values within bounds', () => {
  assert.equal(clamp(100, 0, 10), 10);
  assert.equal(clamp(-10, 0, 10), 0);
  assert.equal(clamp(5, 0, 10), 5);
});

test('parseHlaeData accepts valid camera payloads', () => {
  const result = parseHlaeData({
    yaw: 90,
    pitch: 45,
    roll: 10,
    x: 1,
    y: 2,
    z: 3,
    fov: 75,
  });

  assert.deepEqual(result, {
    yaw: 90,
    pitch: 45,
    roll: 10,
    x: 1,
    y: 2,
    z: 3,
    fov: 75,
  });
});

test('parseHlaeData rejects invalid payloads', () => {
  assert.equal(parseHlaeData({ yaw: 'bad' }), null);
  assert.equal(parseHlaeData(null), null);
});

test('writeInt24BEClamped caps values to 24-bit range', () => {
  const buffer = Buffer.alloc(4, 0);

  writeInt24BEClamped(buffer, 0, 8_388_608);
  assert.equal(buffer.readIntBE(0, 3), 8_388_607);

  writeInt24BEClamped(buffer, 0, -8_388_609);
  assert.equal(buffer.readIntBE(0, 3), -8_388_608);
});

test('packAngle and packPosition convert values consistently', () => {
  const angleBuffer = Buffer.alloc(4, 0);
  packAngle(angleBuffer, 0, 0);
  assert.equal(angleBuffer.readIntBE(0, 3), 0);

  const posBuffer = Buffer.alloc(4, 0);
  packPosition(posBuffer, 0, 1);
  assert.equal(posBuffer.readIntBE(0, 3), 256);
});

test('packZoom defaults to 90 when undefined', () => {
  const buffer = Buffer.alloc(4, 0);
  packZoom(buffer, 0, 90);
  assert.equal(buffer.readIntBE(0, 3), 90 * 256);
});

test('buildFreeDPacket writes a valid packet shape', () => {
  const packet = buildFreeDPacket({
    yaw: 10,
    pitch: -20,
    roll: 30,
    x: 1,
    y: 2,
    z: 3,
    fov: 80,
  });

  assert.equal(packet.length, 29);
  assert.equal(packet.readUInt8(0), 0xd1);
  assert.equal(packet.readUInt8(1), 0xff);
  assert.equal(packet.readUInt8(28) & 0xff, (64 - packet.subarray(0, 28).reduce((sum, byte) => sum + byte, 0)) & 0xff);
});

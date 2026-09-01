import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { acceptKey, encodeTextFrame, isCloseFrame, startDevServer } from '../dev-server.js';

describe('acceptKey', () => {
  it('matches the worked example in RFC 6455', () => {
    // §1.3 gives this key and expects this accept value.
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  it('is the documented sha1 of key plus the fixed GUID', () => {
    const key = 'x3JJHMbDL1EzLkh9GBhXDw==';
    const expected = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    expect(acceptKey(key)).toBe(expected);
  });
});

describe('encodeTextFrame', () => {
  it('marks a text frame as final and unmasked', () => {
    const frame = encodeTextFrame('hi');
    expect(frame[0]).toBe(0x81);
    // High bit of byte 1 is the mask flag; a server must never set it.
    expect((frame[1]! & 0x80) === 0).toBe(true);
  });

  it('writes a short payload length inline', () => {
    const frame = encodeTextFrame('a'.repeat(100));
    expect(frame[1]).toBe(100);
    expect(frame.length).toBe(102);
  });

  it.each([
    [125, 2],
    [126, 4],
    [65_535, 4],
    [65_536, 10],
  ])('uses the right header width at length %i', (len, headerBytes) => {
    const frame = encodeTextFrame('a'.repeat(len));
    expect(frame.length).toBe(headerBytes + len);
  });

  it('reads back the 16-bit length it wrote', () => {
    const len = 1000;
    const frame = encodeTextFrame('a'.repeat(len));
    expect(frame[1]).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(len);
  });

  it('reads back the 64-bit length it wrote', () => {
    const len = 70_000;
    const frame = encodeTextFrame('a'.repeat(len));
    expect(frame[1]).toBe(127);
    expect(frame.readBigUInt64BE(2)).toBe(BigInt(len));
  });

  it('counts bytes rather than characters', () => {
    // A payload of multi-byte characters is longer than its string length,
    // and sizing the header off the string would truncate the frame.
    const message = '🜲'.repeat(40);
    const frame = encodeTextFrame(message);
    expect(frame.length - 4).toBe(Buffer.byteLength(message, 'utf8'));
  });

  it('round-trips the payload unchanged', () => {
    const message = JSON.stringify({ path: 'systems/x/styles/a.css', content: 'body{}' });
    const frame = encodeTextFrame(message);
    expect(frame.subarray(2).toString('utf8')).toBe(message);
  });
});

describe('isCloseFrame', () => {
  it('recognises a close opcode', () => {
    expect(isCloseFrame(Buffer.from([0x88, 0x00]))).toBe(true);
  });

  it.each([[0x81], [0x89], [0x8a]])('does not mistake opcode %i for a close', (byte) => {
    expect(isCloseFrame(Buffer.from([byte, 0x00]))).toBe(false);
  });

  it('handles an empty chunk', () => {
    expect(isCloseFrame(Buffer.alloc(0))).toBe(false);
  });
});

describe('startDevServer', () => {
  it('listens, reports no clients, and closes', async () => {
    const server = await startDevServer({ port: 0 });
    expect(server.clientCount()).toBe(0);
    expect(() => server.broadcast('{}')).not.toThrow();
    await server.close();
  });

  it('reports the port the OS actually assigned, not the one requested', async () => {
    const server = await startDevServer({ port: 0 });
    expect(server.port).toBeGreaterThan(0);
    await server.close();
  });

  it('refuses to start on a port already in use', async () => {
    const first = await startDevServer({ port: 0 });
    await expect(startDevServer({ port: first.port })).rejects.toThrow();
    await first.close();
  });

  it('frees the port once closed', async () => {
    const first = await startDevServer({ port: 0 });
    const { port } = first;
    await first.close();
    const second = await startDevServer({ port });
    expect(second.port).toBe(port);
    await second.close();
  });
});

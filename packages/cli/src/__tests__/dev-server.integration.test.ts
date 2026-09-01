/**
 * The handshake and framing are hand-written, so testing them against the
 * encoder that produced them proves nothing. These drive a real WebSocket
 * client — the same implementation a browser uses — against the real server.
 */
import { describe, expect, it } from 'vitest';
import { startDevServer } from '../dev-server.js';

/** Resolve once the client is open, or fail the test rather than hang. */
function open(url: string, timeoutMs = 4000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('client never opened')), timeoutMs);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('client errored before opening'));
    });
  });
}

function nextMessage(socket: WebSocket, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no message arrived')), timeoutMs);
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer);
        resolve(String((event as MessageEvent).data));
      },
      { once: true },
    );
  });
}

describe('dev server against a real client', () => {
  it('completes the handshake a real WebSocket accepts', async () => {
    const server = await startDevServer({ port: 0 });
    const client = await open(`ws://127.0.0.1:${server.port}`);
    expect(client.readyState).toBe(WebSocket.OPEN);
    client.close();
    await server.close();
  });

  it('delivers a payload the client decodes intact', async () => {
    const server = await startDevServer({ port: 0 });
    const client = await open(`ws://127.0.0.1:${server.port}`);
    const received = nextMessage(client);

    const frame = JSON.stringify({
      packageType: 'system',
      packageId: 'my-system',
      content: 'body { color: red; }',
      path: 'systems/my-system/styles/main.css',
      extension: 'css',
    });
    server.broadcast(frame);

    expect(await received).toBe(frame);
    client.close();
    await server.close();
  });

  it.each([
    ['short', 10],
    ['just under the 16-bit boundary', 125],
    ['at the 16-bit boundary', 126],
    ['past the 16-bit boundary', 70_000],
  ])('delivers a %s payload without truncation', async (_label, size) => {
    const server = await startDevServer({ port: 0 });
    const client = await open(`ws://127.0.0.1:${server.port}`);
    const received = nextMessage(client);

    const message = 'x'.repeat(size);
    server.broadcast(message);

    const got = await received;
    expect(got.length).toBe(size);
    expect(got).toBe(message);
    client.close();
    await server.close();
  });

  it('survives multi-byte characters, where byte length and string length differ', async () => {
    const server = await startDevServer({ port: 0 });
    const client = await open(`ws://127.0.0.1:${server.port}`);
    const received = nextMessage(client);

    const message = `🜲 ${'ação'.repeat(50)}`;
    server.broadcast(message);

    expect(await received).toBe(message);
    client.close();
    await server.close();
  });

  it('reaches every connected client', async () => {
    const server = await startDevServer({ port: 0 });
    const a = await open(`ws://127.0.0.1:${server.port}`);
    const b = await open(`ws://127.0.0.1:${server.port}`);
    const both = Promise.all([nextMessage(a), nextMessage(b)]);

    server.broadcast('hello');
    expect(await both).toEqual(['hello', 'hello']);

    a.close();
    b.close();
    await server.close();
  });

  it('answers a plain HTTP request instead of hanging', async () => {
    const server = await startDevServer({ port: 0 });
    const res = await fetch(`http://127.0.0.1:${server.port}`);
    expect(res.status).toBe(426);
    expect(await res.text()).toContain('WebSocket');
    await server.close();
  });
});

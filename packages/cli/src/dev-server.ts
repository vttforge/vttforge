/**
 * A one-way WebSocket server: `vttforge dev` pushes, the dev module listens.
 *
 * Hand-written rather than pulled from a package. The CLI ships to every
 * consumer, so each dependency is one they install too, and what is needed
 * here is a narrow slice of RFC 6455: accept the upgrade, send unmasked text
 * frames, notice when a client goes away. No client payloads are read, no
 * compression, no extensions.
 */
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Duplex } from 'node:stream';

/** Fixed GUID from RFC 6455 §1.3, concatenated with the client key. */
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Frame lengths above these switch to a wider length field. */
const LEN_16_BIT = 126;
const LEN_64_BIT = 65_536;

/** Opcode 0x8 — the client is closing. */
const OPCODE_CLOSE = 0x8;

export interface DevServer {
  /** Send one message to every connected client. */
  broadcast: (message: string) => void;
  /** Number of clients currently attached — used to say something truthful. */
  clientCount: () => number;
  close: () => Promise<void>;
  /**
   * The port actually bound, which is not always the one requested: port 0
   * asks the OS to choose. Reporting the request back would leave the caller
   * unable to tell anyone where to connect.
   */
  port: number;
}

/**
 * Compute the handshake response header.
 *
 * Exported because it is the one part of the handshake with a published test
 * vector, and a wrong value fails as a silent non-connection.
 */
export function acceptKey(clientKey: string): string {
  return createHash('sha1')
    .update(clientKey + WS_GUID)
    .digest('base64');
}

/**
 * Encode one text frame, server to client.
 *
 * Server frames are never masked. The payload length picks one of three
 * widths, and getting the boundary wrong corrupts the stream rather than
 * failing loudly — hence the explicit constants and the tests around them.
 */
export function encodeTextFrame(message: string): Buffer {
  const payload = Buffer.from(message, 'utf8');
  const len = payload.length;

  let header: Buffer;
  if (len < LEN_16_BIT) {
    header = Buffer.from([0x81, len]);
  } else if (len < LEN_64_BIT) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = LEN_16_BIT;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Is this inbound frame a close? That is the only opcode worth reading. */
export function isCloseFrame(chunk: Buffer): boolean {
  const first = chunk.at(0);
  return first !== undefined && (first & 0x0f) === OPCODE_CLOSE;
}

export interface StartOptions {
  port: number;
  /** Loopback by default: this serves a developer's own machine. */
  host?: string;
}

export async function startDevServer(options: StartOptions): Promise<DevServer> {
  const sockets = new Set<Duplex>();

  // A plain GET gets a flat answer. Anything that is not an upgrade has
  // reached the wrong port, and saying so beats an unexplained hang.
  const server: Server = createServer((_req, res) => {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('This port speaks WebSocket only — it is the vttforge dev bridge.\n');
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey(key)}`,
        '\r\n',
      ].join('\r\n'),
    );
    // Nagle would hold small frames back waiting for company; a reload
    // payload should leave immediately. Node types the upgrade socket as a
    // Duplex even though an HTTP upgrade always hands over a TCP socket, so
    // check for the method rather than asserting the wider type away.
    if ('setNoDelay' in socket && typeof socket.setNoDelay === 'function') {
      (socket as Duplex & { setNoDelay: (on: boolean) => void }).setNoDelay(true);
    }
    sockets.add(socket);

    const drop = () => {
      sockets.delete(socket);
      socket.destroy();
    };
    socket.on('data', (chunk: Buffer) => {
      if (isCloseFrame(chunk)) drop();
    });
    socket.on('close', () => sockets.delete(socket));
    // A browser tab closing surfaces as an error on some platforms and a
    // close on others. Either way the socket is gone, and neither should
    // reach the top level.
    socket.on('error', drop);
  });

  await new Promise<void>((resolveStart, rejectStart) => {
    server.once('error', rejectStart);
    server.listen(options.port, options.host ?? '127.0.0.1', () => {
      server.removeListener('error', rejectStart);
      resolveStart();
    });
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : options.port;

  return {
    broadcast: (message) => {
      const frame = encodeTextFrame(message);
      for (const socket of sockets) {
        // One dead socket must not stop the rest from being told.
        try {
          socket.write(frame);
        } catch {
          sockets.delete(socket);
        }
      }
    },
    clientCount: () => sockets.size,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    },
    port: boundPort,
  };
}

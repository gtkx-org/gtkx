import { mkdtempSync, rmSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect } from "vitest";
import type { Request } from "../src/protocol/schemas.js";
import type { ConnectionRequestEvent, ProtocolConnection } from "../src/transport.js";
import { ConnectionRegistry } from "../src/connection-registry.js";
import { SocketServer } from "../src/socket-server.js";

type SocketServerContext = {
    tmpDir: string;
    socketPath: string;
    server: SocketServer;
    registry: ConnectionRegistry;
};

const socketCtx = {} as SocketServerContext;

const connectClient = (path: string): Promise<net.Socket> =>
    new Promise((resolve, reject) => {
        const socket = net.createConnection(path);

        socket.once("connect", () => {
            resolve(socket);
        });

        socket.once("error", reject);
    });

const tryConnect = (path: string): Promise<Error | null> =>
    new Promise((resolve) => {
        const socket = net.createConnection(path);

        socket.once("connect", () => {
            socket.destroy();
            resolve(null);
        });

        socket.once("error", (error) => {
            resolve(error);
        });
    });

const collectLines = (socket: net.Socket): { lines: string[]; promise: Promise<void> } => {
    let buffer = "";
    const lines: string[] = [];

    const promise: Promise<void> = new Promise((resolve) => {
        socket.on("data", (data: Buffer) => {
            buffer += data.toString();
            let idx = buffer.indexOf("\n");

            while (idx !== -1) {
                lines.push(buffer.slice(0, idx));
                buffer = buffer.slice(idx + 1);
                idx = buffer.indexOf("\n");
            }
        });

        socket.on("close", () => {
            resolve();
        });
    });

    return { lines, promise };
};

const waitForConnection = (registry: ConnectionRegistry): Promise<ProtocolConnection> =>
    new Promise((resolve) => {
        const original = registry.register.bind(registry);

        registry.register = (socket) => {
            const connection = original(socket);
            registry.register = original;
            resolve(connection);

            return connection;
        };
    });

function setupSocketServer(): void {
    beforeEach(() => {
        socketCtx.tmpDir = mkdtempSync(join(tmpdir(), "gtkx-socket-server-"));
        socketCtx.socketPath = join(socketCtx.tmpDir, "test.sock");
        socketCtx.registry = new ConnectionRegistry();
        socketCtx.server = new SocketServer(socketCtx.registry, socketCtx.socketPath);
    });

    afterEach(async () => {
        await socketCtx.server.stop();
        rmSync(socketCtx.tmpDir, { recursive: true, force: true });
    });
}

const startWithClient = async (): Promise<net.Socket> => {
    await socketCtx.server.start();

    return connectClient(socketCtx.socketPath);
};

const startWithConnection = async (): Promise<{ client: net.Socket; connection: ProtocolConnection }> => {
    await socketCtx.server.start();
    const connectionPromise = waitForConnection(socketCtx.registry);
    const client = await connectClient(socketCtx.socketPath);

    return { client, connection: await connectionPromise };
};

const nextRequest = (registry: ConnectionRegistry): Promise<Request> =>
    new Promise((resolve) => {
        registry.addEventListener(
            "request",
            (event) => {
                resolve((event as ConnectionRequestEvent).detail.request);
            },
            { once: true },
        );
    });

const collectFirstFrame = async <T>(client: net.Socket, act: () => void): Promise<T> => {
    const collector = collectLines(client);
    act();
    const deadline = Date.now() + 2000;

    while (collector.lines.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }

    client.destroy();
    await collector.promise;
    expect(collector.lines.length).toBeGreaterThan(0);

    return JSON.parse(collector.lines[0] as string) as T;
};

export {
    collectFirstFrame,
    connectClient,
    nextRequest,
    setupSocketServer,
    socketCtx,
    startWithClient,
    startWithConnection,
    tryConnect,
};

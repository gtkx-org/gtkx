import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionRegistry } from "../src/connection-registry.js";
import type { Message, Request, Response } from "../src/protocol/types.js";
import { SocketServer } from "../src/socket-server.js";
import type { ProtocolConnection } from "../src/transport.js";

const connectClient = (path: string): Promise<net.Socket> =>
    new Promise((resolve, reject) => {
        const socket = net.createConnection(path);
        socket.once("connect", () => resolve(socket));
        socket.once("error", reject);
    });

const tryConnect = (path: string): Promise<Error | null> =>
    new Promise((resolve) => {
        const socket = net.createConnection(path);
        socket.once("connect", () => {
            socket.destroy();
            resolve(null);
        });
        socket.once("error", (error) => resolve(error));
    });

const collectLines = (socket: net.Socket): { lines: string[]; promise: Promise<void> } => {
    let buffer = "";
    const lines: string[] = [];
    const promise = new Promise<void>((resolve) => {
        socket.on("data", (data: Buffer) => {
            buffer += data.toString();
            let idx = buffer.indexOf("\n");
            while (idx !== -1) {
                lines.push(buffer.slice(0, idx));
                buffer = buffer.slice(idx + 1);
                idx = buffer.indexOf("\n");
            }
        });
        socket.on("close", () => resolve());
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

type SocketServerContext = {
    tmpDir: string;
    socketPath: string;
    server: SocketServer;
    registry: ConnectionRegistry;
};

const socketCtx = {} as SocketServerContext;

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

const nextRequest = (registry: ConnectionRegistry): Promise<Request> =>
    new Promise((resolve) => {
        registry.once("request", (_conn, req) => resolve(req));
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

describe("SocketServer lifecycle", () => {
    setupSocketServer();
    it("does not accept connections before start", async () => {
        const error = await tryConnect(socketCtx.socketPath);
        expect(error).not.toBeNull();
    });

    it("accepts connections after start and refuses them after stop", async () => {
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        client.destroy();

        await socketCtx.server.stop();
        const error = await tryConnect(socketCtx.socketPath);
        expect(error).not.toBeNull();
    });

    it("is idempotent when start is called twice", async () => {
        await socketCtx.server.start();
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        client.destroy();
    });

    it("is idempotent when stop is called without a prior start", async () => {
        await expect(socketCtx.server.stop()).resolves.toBeUndefined();
    });

    it("removes a stale socket file on start", async () => {
        writeFileSync(socketCtx.socketPath, "");
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        client.destroy();
    });

    it("refuses to start while another live server owns the socket path", async () => {
        await socketCtx.server.start();

        const second = new SocketServer(new ConnectionRegistry(), socketCtx.socketPath);
        await expect(second.start()).rejects.toThrow(/already owns/);

        const client = await connectClient(socketCtx.socketPath);
        client.destroy();
    });
});

describe("SocketServer connections", () => {
    setupSocketServer();
    it("registers a connection and emits a disconnection event", async () => {
        const { server, socketPath, registry } = socketCtx;
        await server.start();

        const connectionPromise = waitForConnection(registry);
        const client = await connectClient(socketPath);
        const connection = await connectionPromise;
        expect(connection.id).toBeTruthy();

        const disconnectionPromise = new Promise<ProtocolConnection>((resolve) => {
            registry.once("disconnection", (conn) => resolve(conn));
        });
        client.end();
        const disconnected = await disconnectionPromise;
        expect(disconnected.id).toBe(connection.id);
    });
});

describe("SocketServer framing — request events", () => {
    setupSocketServer();
    it("emits a request event for valid request frames", async () => {
        const client = await startWithClient();
        const received = nextRequest(socketCtx.registry);

        const request: Request = { id: "r-1", method: "ping", params: { a: 1 } };
        client.write(`${JSON.stringify(request)}\n`);

        const got = await received;
        expect(got.id).toBe("r-1");
        expect(got.method).toBe("ping");

        client.destroy();
    });
});

describe("SocketServer framing — chunking & blanks", () => {
    setupSocketServer();
    it("ignores blank lines between frames", async () => {
        const client = await startWithClient();
        const received = nextRequest(socketCtx.registry);

        client.write("\n\n");
        client.write(`${JSON.stringify({ id: "r-3", method: "ping" })}\n`);

        const got = await received;
        expect(got.id).toBe("r-3");

        client.destroy();
    });

    it("frames messages spanning multiple TCP chunks", async () => {
        const client = await startWithClient();
        const received = nextRequest(socketCtx.registry);

        const message = JSON.stringify({ id: "r-split", method: "ping" });
        const half = Math.floor(message.length / 2);
        client.write(message.slice(0, half));
        await new Promise((resolve) => setTimeout(resolve, 10));
        client.write(`${message.slice(half)}\n`);

        const got = await received;
        expect(got.id).toBe("r-split");

        client.destroy();
    });
});

describe("SocketServer framing — error responses", () => {
    setupSocketServer();
    it("returns an Invalid JSON error response for malformed lines", async () => {
        const client = await startWithClient();

        const parsed = await collectFirstFrame<Response>(client, () => client.write("not-json\n"));
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid JSON");
    });

    it("returns an Invalid message format error for unknown shapes", async () => {
        const client = await startWithClient();

        const parsed = await collectFirstFrame<Response>(client, () =>
            client.write(`${JSON.stringify({ random: true })}\n`),
        );
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid message format");
    });

    it("returns an Invalid message format error when a request payload fails schema validation", async () => {
        const client = await startWithClient();

        const parsed = await collectFirstFrame<Response & { id: unknown }>(client, () =>
            client.write(`${JSON.stringify({ id: 7, method: "ping" })}\n`),
        );
        expect(parsed.error?.message).toContain("Invalid message format");
    });
});

describe("ConnectionRegistry send", () => {
    setupSocketServer();
    it("silently drops a message for an unknown connection id", async () => {
        await socketCtx.server.start();
        expect(() => socketCtx.registry.send("missing", { id: "x", method: "noop" } as Message)).not.toThrow();
    });

    it("delivers a message to the connected client", async () => {
        const { server, socketPath, registry } = socketCtx;
        await server.start();

        const connectionPromise = waitForConnection(registry);
        const client = await connectClient(socketPath);
        const connection = await connectionPromise;

        const parsed = await collectFirstFrame<Message>(client, () =>
            registry.send(connection.id, { id: "out-1", result: 42 } as Message),
        );
        expect((parsed as { id: string }).id).toBe("out-1");
    });
});

describe("ConnectionRegistry shutdown", () => {
    setupSocketServer();
    it("rejects in-flight requests and drains the connection when dispose runs", async () => {
        const { server, socketPath, registry } = socketCtx;
        await server.start();

        const connectionPromise = waitForConnection(registry);
        await connectClient(socketPath);
        const connection = await connectionPromise;

        const pending = connection.send("ping", {}, 5000);
        const disconnection = new Promise<void>((resolve) => registry.once("disconnection", () => resolve()));
        registry.dispose("Server stopping");

        await expect(pending).rejects.toThrow("Server stopping");
        await disconnection;
    });
});

describe("SocketServer errors", () => {
    setupSocketServer();
    it("rejects start and routes error to the registry when binding to an unreachable path", async () => {
        const badRegistry = new ConnectionRegistry();
        const bad = new SocketServer(badRegistry, join(socketCtx.tmpDir, "no-such-dir", "test.sock"));
        const errorReceived = new Promise<Error>((resolve) => {
            badRegistry.once("error", (err) => resolve(err));
        });

        await expect(bad.start()).rejects.toThrow();
        const got = await errorReceived;
        expect(got).toBeInstanceOf(Error);

        await bad.stop();
    });
});

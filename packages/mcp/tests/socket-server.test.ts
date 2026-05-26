import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IpcMessage, IpcRequest, IpcResponse } from "../src/protocol/types.js";
import { SocketServer } from "../src/socket-server.js";
import type { AppConnection } from "../src/transport.js";

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

const waitForConnection = (server: SocketServer): Promise<AppConnection> =>
    new Promise((resolve) => {
        server.once("connection", (connection) => resolve(connection));
    });

interface SocketServerCtx {
    tmpDir: string;
    socketPath: string;
    server: SocketServer;
}

const socketCtx = {} as SocketServerCtx;

function setupSocketServer(): void {
    beforeEach(() => {
        socketCtx.tmpDir = mkdtempSync(join(tmpdir(), "gtkx-socket-server-"));
        socketCtx.socketPath = join(socketCtx.tmpDir, "ipc.sock");
        socketCtx.server = new SocketServer(socketCtx.socketPath);
    });

    afterEach(async () => {
        await socketCtx.server.stop();
        rmSync(socketCtx.tmpDir, { recursive: true, force: true });
    });
}

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
});

describe("SocketServer connections", () => {
    setupSocketServer();
    it("emits connection and disconnection events", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();

        const connectionPromise = waitForConnection(server);
        const client = await connectClient(socketPath);
        const connection = await connectionPromise;
        expect(connection.id).toBeTruthy();

        const disconnectionPromise = new Promise<AppConnection>((resolve) => {
            server.once("disconnection", (conn) => resolve(conn));
        });
        client.end();
        const disconnected = await disconnectionPromise;
        expect(disconnected.id).toBe(connection.id);
    });
});

describe("SocketServer framing — request events", () => {
    setupSocketServer();
    it("emits a request event for valid request frames", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);

        const received = new Promise<IpcRequest>((resolve) => {
            server.once("request", (_conn, req) => resolve(req));
        });

        const request: IpcRequest = { id: "r-1", method: "ping", params: { a: 1 } };
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
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);

        const received = new Promise<IpcRequest>((resolve) => {
            server.once("request", (_conn, req) => resolve(req));
        });

        client.write("\n\n");
        client.write(`${JSON.stringify({ id: "r-3", method: "ping" })}\n`);

        const got = await received;
        expect(got.id).toBe("r-3");

        client.destroy();
    });

    it("frames messages spanning multiple TCP chunks", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);

        const received = new Promise<IpcRequest>((resolve) => {
            server.once("request", (_conn, req) => resolve(req));
        });

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
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);
        const collector = collectLines(client);

        client.write("not-json\n");

        await new Promise((resolve) => setTimeout(resolve, 20));
        client.destroy();
        await collector.promise;

        expect(collector.lines.length).toBeGreaterThan(0);
        const parsed = JSON.parse(collector.lines[0] as string) as IpcResponse;
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid JSON");
    });

    it("returns an Invalid message format error for unknown shapes", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);
        const collector = collectLines(client);

        client.write(`${JSON.stringify({ random: true })}\n`);

        await new Promise((resolve) => setTimeout(resolve, 20));
        client.destroy();
        await collector.promise;

        expect(collector.lines.length).toBeGreaterThan(0);
        const parsed = JSON.parse(collector.lines[0] as string) as IpcResponse;
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid message format");
    });

    it("returns an Invalid message format error when a request payload fails schema validation", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();
        const client = await connectClient(socketPath);
        const collector = collectLines(client);

        client.write(`${JSON.stringify({ id: 7, method: "ping" })}\n`);

        await new Promise((resolve) => setTimeout(resolve, 20));
        client.destroy();
        await collector.promise;

        expect(collector.lines.length).toBeGreaterThan(0);
        const parsed = JSON.parse(collector.lines[0] as string) as IpcResponse & { id: unknown };
        expect(parsed.error?.message).toContain("Invalid message format");
    });
});

describe("SocketServer send", () => {
    setupSocketServer();
    it("send silently drops a message for an unknown connection id", async () => {
        await socketCtx.server.start();
        expect(() =>
            socketCtx.server.send("missing", { id: "x", method: "noop" } as IpcMessage),
        ).not.toThrow();
    });

    it("send delivers a message to the connected client", async () => {
        const { server, socketPath } = socketCtx;
        await server.start();

        const connectionPromise = waitForConnection(server);
        const client = await connectClient(socketPath);
        const connection = await connectionPromise;

        const collector = collectLines(client);
        server.send(connection.id, { id: "out-1", result: 42 } as IpcMessage);

        await new Promise((resolve) => setTimeout(resolve, 20));
        client.destroy();
        await collector.promise;

        expect(collector.lines.length).toBeGreaterThan(0);
        const parsed = JSON.parse(collector.lines[0] as string) as IpcMessage;
        expect((parsed as { id: string }).id).toBe("out-1");
    });
});

describe("SocketServer errors", () => {
    setupSocketServer();
    it("rejects start and emits error when binding to an unreachable path", async () => {
        const bad = new SocketServer(join(socketCtx.tmpDir, "no-such-dir", "ipc.sock"));
        const errorReceived = new Promise<Error>((resolve) => {
            bad.once("error", (err) => resolve(err));
        });

        await expect(bad.start()).rejects.toThrow();
        const got = await errorReceived;
        expect(got).toBeInstanceOf(Error);

        await bad.stop();
    });
});

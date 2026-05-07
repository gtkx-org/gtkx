import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IpcMessage, IpcRequest, IpcResponse } from "../src/protocol/types.js";
import { SocketServer } from "../src/socket-server.js";

const connectClient = (path: string): Promise<net.Socket> =>
    new Promise((resolve, reject) => {
        const socket = net.createConnection(path);
        socket.once("connect", () => resolve(socket));
        socket.once("error", reject);
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

const waitForEvent = <T>(server: SocketServer, event: Parameters<SocketServer["once"]>[0]): Promise<T> =>
    new Promise((resolve) => {
        server.once(event, ((...args: unknown[]) => {
            resolve(args.length === 1 ? (args[0] as T) : (args as unknown as T));
        }) as never);
    });

describe("SocketServer", () => {
    let tmpDir: string;
    let socketPath: string;
    let server: SocketServer;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "gtkx-socket-server-"));
        socketPath = join(tmpDir, "ipc.sock");
        server = new SocketServer(socketPath);
    });

    afterEach(async () => {
        await server.stop();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it("exposes the configured socket path", () => {
        expect(server.path).toBe(socketPath);
    });

    it("reports not listening before start", () => {
        expect(server.isListening).toBe(false);
    });

    it("listens after start and stops cleanly", async () => {
        await server.start();
        expect(server.isListening).toBe(true);

        await server.stop();
        expect(server.isListening).toBe(false);
    });

    it("is idempotent when start is called twice", async () => {
        await server.start();
        await server.start();
        expect(server.isListening).toBe(true);
    });

    it("is idempotent when stop is called without a prior start", async () => {
        await expect(server.stop()).resolves.toBeUndefined();
    });

    it("removes a stale socket file on start", async () => {
        writeFileSync(socketPath, "");
        await server.start();
        expect(server.isListening).toBe(true);
    });

    it("emits connection and disconnection events", async () => {
        await server.start();

        const connectionPromise = waitForEvent(server, "connection");
        const client = await connectClient(socketPath);
        await connectionPromise;

        expect(server.getConnections().length).toBe(1);

        const disconnectionPromise = waitForEvent(server, "disconnection");
        client.end();
        await disconnectionPromise;

        expect(server.getConnections().length).toBe(0);
    });

    it("getConnection returns undefined for an unknown id", async () => {
        await server.start();
        expect(server.getConnection("nope")).toBeUndefined();
    });

    it("emits a request event for valid request frames", async () => {
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

    it("emits a response event for valid response frames (no method field)", async () => {
        await server.start();
        const client = await connectClient(socketPath);

        const received = new Promise<IpcResponse>((resolve) => {
            server.once("response", (_conn, res) => resolve(res));
        });

        const response: IpcResponse = { id: "r-2", result: { ok: true } };
        client.write(`${JSON.stringify(response)}\n`);

        const got = await received;
        expect(got.id).toBe("r-2");

        client.destroy();
    });

    it("returns an Invalid JSON error response for malformed lines", async () => {
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

    it("ignores blank lines between frames", async () => {
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

    it("send returns false for an unknown connection id", async () => {
        await server.start();
        const ok = server.send("missing", { id: "x", method: "noop" } as IpcMessage);
        expect(ok).toBe(false);
    });

    it("send delivers a message to the connected client", async () => {
        await server.start();

        const connectionPromise = waitForEvent(server, "connection");
        const client = await connectClient(socketPath);
        await connectionPromise;

        const collector = collectLines(client);
        const conn = server.getConnections()[0];
        if (!conn) throw new Error("expected one connection");
        const ok = server.send(conn.id, { id: "out-1", result: 42 } as IpcMessage);
        expect(ok).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 20));
        client.destroy();
        await collector.promise;

        expect(collector.lines.length).toBeGreaterThan(0);
        const parsed = JSON.parse(collector.lines[0] as string) as IpcMessage;
        expect((parsed as { id: string }).id).toBe("out-1");
    });

    it("emits an error event when a connected socket errors", async () => {
        await server.start();

        const connectionPromise = waitForEvent(server, "connection");
        const client = await connectClient(socketPath);
        await connectionPromise;

        const errorReceived = new Promise<Error>((resolve) => {
            server.once("error", (err) => resolve(err));
        });

        const conn = server.getConnections()[0];
        if (!conn) throw new Error("expected one connection");
        conn.socket.emit("error", new Error("boom"));

        const got = await errorReceived;
        expect(got.message).toBe("boom");
        client.destroy();
    });

    it("rejects start and emits error when binding to an unreachable path", async () => {
        const bad = new SocketServer(join(tmpDir, "no-such-dir", "ipc.sock"));
        const errorReceived = new Promise<Error>((resolve) => {
            bad.once("error", (err) => resolve(err));
        });

        await expect(bad.start()).rejects.toThrow();
        const got = await errorReceived;
        expect(got).toBeInstanceOf(Error);

        await bad.stop();
    });

    it("frames messages spanning multiple TCP chunks", async () => {
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

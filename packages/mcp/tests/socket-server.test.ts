import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Request, Response } from "../src/protocol/schemas.js";
import type { ConnectionErrorEvent, ConnectionEvent, ProtocolConnection } from "../src/transport.js";
import { ConnectionRegistry } from "../src/connection-registry.js";
import { SocketServer } from "../src/socket-server.js";
import {
    collectFirstFrame,
    connectClient,
    nextRequest,
    setupSocketServer,
    socketCtx,
    startWithClient,
    startWithConnection,
    tryConnect,
} from "./socket-server-harness.js";

const collectErrorResponse = async (payload: string): Promise<Response> => {
    const client = await startWithClient();

    return collectFirstFrame<Response>(client, () => {
        client.write(payload);
    });
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
        expect(client.readyState).toBe("open");
        client.destroy();
    });

    it("is idempotent when stop is called without a prior start", async () => {
        await expect(socketCtx.server.stop()).resolves.toBeUndefined();
    });

    it("removes a stale socket file on start", async () => {
        writeFileSync(socketCtx.socketPath, "");
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
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
        const { client, connection } = await startWithConnection();
        expect(connection.id).toBeTruthy();

        const disconnectionPromise: Promise<ProtocolConnection> = new Promise((resolve) => {
            socketCtx.registry.addEventListener(
                "disconnection",
                (event) => {
                    resolve((event as ConnectionEvent).detail);
                },
                { once: true },
            );
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
        const parsed = await collectErrorResponse("not-json\n");
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid JSON");
    });

    it("returns an Invalid message format error for unknown shapes", async () => {
        const parsed = await collectErrorResponse(`${JSON.stringify({ random: true })}\n`);
        expect(parsed.id).toBe("unknown");
        expect(parsed.error?.message).toContain("Invalid message format");
    });

    it("returns an Invalid message format error when a request payload fails schema validation", async () => {
        const parsed = await collectErrorResponse(`${JSON.stringify({ id: 7, method: "ping" })}\n`);
        expect(parsed.error?.message).toContain("Invalid message format");
    });
});

describe("SocketServer errors", () => {
    setupSocketServer();

    it("rejects start and routes error to the registry when binding to an unreachable path", async () => {
        const badRegistry = new ConnectionRegistry();
        const bad = new SocketServer(badRegistry, join(socketCtx.tmpDir, "no-such-dir", "test.sock"));

        const errorReceived: Promise<Error> = new Promise((resolve) => {
            badRegistry.addEventListener(
                "error",
                (event) => {
                    resolve((event as ConnectionErrorEvent).detail);
                },
                { once: true },
            );
        });

        await expect(bad.start()).rejects.toThrow();
        const got = await errorReceived;
        expect(got).toBeInstanceOf(Error);
        await bad.stop();
    });
});

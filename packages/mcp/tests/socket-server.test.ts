import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as net from "node:net";
import { basename, dirname, join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import type { Request, Response } from "../src/protocol/schemas.js";
import type { ConnectionErrorEvent, ConnectionEvent, ProtocolConnection } from "../src/transport.js";
import { ConnectionRegistry } from "../src/connection-registry.js";
import { SocketServer, withClaimLock } from "../src/socket-server.js";
import {
    abandonSocket,
    collectFirstFrame,
    connectClient,
    connectWhenReady,
    delay,
    inodeFor,
    listeningPathIn,
    nextRequest,
    padSocketPath,
    saturateOwnerBacklog,
    setupSocketServer,
    socketCtx,
    startTracked,
    startWithClient,
    startWithConnection,
    tryConnect,
} from "./socket-server-harness.js";

const BLOCKED_LISTENER_MS = 5000;
const DRAIN_TIMEOUT_MS = 15_000;
const DRAIN_TEST_TIMEOUT_MS = 30_000;
const CONTENDER_COUNT = 4;
const MAX_PATH_LENGTH = 108;
const SOCKET_NAMES = ["gtkx-mcp.sock", "s.sock"];
const CLAIM_WAIT_MS = 300;

const collectErrorResponse = async (payload: string): Promise<Response> => {
    const client = await startWithClient();

    return collectFirstFrame<Response>(client, () => {
        client.write(payload);
    });
};

const closeImpostor = (impostor: net.Server): Promise<void> =>
    new Promise((resolve) => {
        impostor.close(() => {
            resolve();
        });
    });

const listenImpostor = async (path: string): Promise<void> => {
    const impostor = net.createServer((socket) => socket.end());

    onTestFinished(async () => {
        await closeImpostor(impostor);
    });

    await new Promise<void>((resolve) => {
        impostor.listen(path, resolve);
    });
};

const refusalFor = async (server: SocketServer): Promise<string> => {
    try {
        await server.start();
    } catch (error) {
        expect(error).toBeInstanceOf(Error);

        return error instanceof Error ? error.message : String(error);
    }

    throw new Error("start resolved instead of refusing to take the socket path");
};

const raceStarts = async (count: number): Promise<string[]> => {
    const contenders = Array.from(
        { length: count },
        () => new SocketServer(new ConnectionRegistry(), socketCtx.socketPath),
    );

    onTestFinished(async () => {
        await Promise.all(contenders.map((contender) => contender.stop()));
    });

    const settled = await Promise.allSettled(contenders.map((contender) => contender.start()));

    return settled.map((result) => (result.status === "rejected" ? (result.reason as Error).message : "started"));
};

const expectSingleWinner = (outcomes: string[]): void => {
    expect(outcomes.filter((outcome) => outcome === "started")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.includes("already owns"))).toHaveLength(CONTENDER_COUNT - 1);
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
        const inode = inodeFor(socketCtx.socketPath);
        const second = new SocketServer(new ConnectionRegistry(), socketCtx.socketPath);
        const message = await refusalFor(second);
        expect(message).toContain(socketCtx.socketPath);
        expect(message).toMatch(/already owns/);
        expect(message).toMatch(/Stop the other server/);
        expect(inodeFor(socketCtx.socketPath)).toBe(inode);
        const client = await connectClient(socketCtx.socketPath);
        client.destroy();
    });
});

describe("SocketServer socket paths", () => {
    setupSocketServer();

    it("leaves only the published socket in the runtime directory", async () => {
        await socketCtx.server.start();
        expect(readdirSync(socketCtx.tmpDir)).toEqual([basename(socketCtx.socketPath)]);
        await socketCtx.server.stop();
        expect(readdirSync(socketCtx.tmpDir)).toEqual([]);
    });

    it("listens beside the published socket under a hidden name no longer than it", async () => {
        await socketCtx.server.start();
        const listening = listeningPathIn(socketCtx.tmpDir) ?? "";
        expect(dirname(listening)).toBe(socketCtx.tmpDir);
        expect(basename(listening)).toMatch(/^\.[0-9a-f]+$/);
        expect(listening.length).toBeLessThanOrEqual(socketCtx.socketPath.length);
    });

    it.each(SOCKET_NAMES)("starts on a %s path that fills the address limit", async (name) => {
        const socketPath = padSocketPath(socketCtx.tmpDir, name, MAX_PATH_LENGTH);
        expect(socketPath).toHaveLength(MAX_PATH_LENGTH);
        const server = new SocketServer(new ConnectionRegistry(), socketPath);

        onTestFinished(async () => {
            await server.stop();
        });

        await server.start();
        const client = await connectClient(socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
    });
});

describe("SocketServer socket ownership", () => {
    setupSocketServer();

    it("keeps a live server's socket when the liveness probe cannot connect", async () => {
        await saturateOwnerBacklog(socketCtx.socketPath, BLOCKED_LISTENER_MS);
        const inode = inodeFor(socketCtx.socketPath);
        const message = await refusalFor(socketCtx.server);
        expect(message).toContain(socketCtx.socketPath);
        expect(message).toMatch(/Could not tell whether/);
        expect(message).toMatch(/EAGAIN/);
        expect(message).toMatch(/Leaving the socket in place/);
        expect(inodeFor(socketCtx.socketPath)).toBe(inode);
    });

    it("keeps serving through a refused start once the blocked owner drains its backlog", async () => {
        await saturateOwnerBacklog(socketCtx.socketPath, BLOCKED_LISTENER_MS);
        const inode = inodeFor(socketCtx.socketPath);
        await expect(socketCtx.server.start()).rejects.toThrow(/Could not tell whether/);
        const client = await connectWhenReady(socketCtx.socketPath, DRAIN_TIMEOUT_MS);
        expect(client.readyState).toBe("open");
        client.destroy();
        expect(inodeFor(socketCtx.socketPath)).toBe(inode);
    }, DRAIN_TEST_TIMEOUT_MS);

    it("removes a socket abandoned by a crashed server", async () => {
        await abandonSocket(socketCtx.socketPath);
        expect(inodeFor(socketCtx.socketPath)).not.toBeNull();
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
    });

    it("leaves a socket it did not bind in place when stopping", async () => {
        await socketCtx.server.start();
        rmSync(socketCtx.socketPath);
        await listenImpostor(socketCtx.socketPath);
        const inode = inodeFor(socketCtx.socketPath);
        await socketCtx.server.stop();
        expect(inodeFor(socketCtx.socketPath)).toBe(inode);
        const client = await connectClient(socketCtx.socketPath);
        client.destroy();
    });
});

describe("SocketServer files that are not sockets", () => {
    setupSocketServer();

    it("removes a dangling symlink left at the socket path", async () => {
        symlinkSync(join(socketCtx.tmpDir, "vanished.sock"), socketCtx.socketPath);
        await socketCtx.server.start();
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
    });

    it("refuses to start when a directory sits at the socket path", async () => {
        mkdirSync(socketCtx.socketPath);
        const message = await refusalFor(socketCtx.server);
        expect(message).toContain(socketCtx.socketPath);
        expect(message).toMatch(/is a directory/);
        expect(message).toMatch(/Remove it/);
        expect(existsSync(socketCtx.socketPath)).toBe(true);
    });
});

describe("SocketServer concurrent starts", () => {
    setupSocketServer();

    it("refuses every loser of concurrent starts and leaves one winner listening", async () => {
        const outcomes = await raceStarts(CONTENDER_COUNT);
        expectSingleWinner(outcomes);
        expect(inodeFor(socketCtx.socketPath)).not.toBeNull();
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
    });

    it("refuses every loser of concurrent starts racing over a socket a crashed server left", async () => {
        await abandonSocket(socketCtx.socketPath);
        const outcomes = await raceStarts(CONTENDER_COUNT);
        expectSingleWinner(outcomes);
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
    });

    it("keeps the socket published when one instance is started twice at once", async () => {
        const settled = await Promise.allSettled([socketCtx.server.start(), socketCtx.server.start()]);
        expect(settled.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
        expect(readdirSync(socketCtx.tmpDir)).toEqual([basename(socketCtx.socketPath)]);
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
        client.destroy();
        await socketCtx.server.stop();
        expect(readdirSync(socketCtx.tmpDir)).toEqual([]);
    });

    it("waits for a claim in flight on the same path instead of racing it", async () => {
        const claim = Promise.withResolvers<null>();
        const holding = withClaimLock(socketCtx.socketPath, () => claim.promise);
        const tracker = startTracked(socketCtx.server);
        await delay(CLAIM_WAIT_MS);
        expect(tracker.isStarted).toBe(false);
        expect(inodeFor(socketCtx.socketPath)).toBeNull();
        claim.resolve(null);
        await holding;
        await tracker.promise;
        const client = await connectClient(socketCtx.socketPath);
        expect(client.readyState).toBe("open");
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

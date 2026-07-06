import EventEmitter from "node:events";
import { Duplex } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../src/app-router.js";
import { ErrorCode, ProtocolError } from "../src/protocol/errors.js";
import type { Message, Request, Response } from "../src/protocol/types.js";
import { type AppConnectionEvents, type AppConnections, ProtocolConnection } from "../src/transport.js";

class FakeSocket extends Duplex {
    lines: string[] = [];

    override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.lines.push(chunk.toString());
        callback();
    }
}

type TestConnection = ProtocolConnection & {
    socket: FakeSocket;
};

const createdConnections: TestConnection[] = [];

function makeConnection(id: string): TestConnection {
    const socket = new FakeSocket();
    const connection = new ProtocolConnection(socket) as TestConnection;
    connection.id = id;
    connection.socket = socket;
    createdConnections.push(connection);
    return connection;
}

class FakeAppConnections extends EventEmitter<AppConnectionEvents> implements AppConnections {
    sent: Array<{ connectionId: string; message: Message }> = [];

    send(connectionId: string, message: Message): void {
        this.sent.push({ connectionId, message });
    }
}

function lastResponse(connections: FakeAppConnections): Response | undefined {
    const entry = connections.sent[connections.sent.length - 1];
    return entry?.message as Response | undefined;
}

function lastOutgoingRequest(conn: TestConnection): Request {
    const line = conn.socket.lines[conn.socket.lines.length - 1];
    if (!line) throw new Error("No outgoing request captured");
    return JSON.parse(line) as Request;
}

type RouterContext = {
    connections: FakeAppConnections;
    router: AppRouter;
};

const ctx = {} as RouterContext;

function emitRegister(conn: TestConnection, params: { applicationId: string; pid?: number }, id = "req-1"): void {
    ctx.connections.emit("request", conn, { id, method: "app.register", params });
}

function registerWithUnregisterSpy(): { conn: TestConnection; onUnregister: ReturnType<typeof vi.fn> } {
    const conn = makeConnection("c1");
    const onUnregister = vi.fn();
    ctx.router.on("appUnregistered", onUnregister);
    emitRegister(conn, { applicationId: "app-a", pid: 1 });
    return { conn, onUnregister };
}

function setupRouterContext(): void {
    beforeEach(() => {
        vi.useFakeTimers();
        createdConnections.length = 0;
        ctx.connections = new FakeAppConnections();
        ctx.router = new AppRouter(ctx.connections);
    });
    afterEach(() => {
        for (const connection of createdConnections) {
            connection.rejectPending(new Error("test teardown"));
        }
        vi.useRealTimers();
    });
}

describe("AppRouter registration — basics", () => {
    setupRouterContext();
    it("registers an app and emits appRegistered with its info", () => {
        const { connections, router } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        router.on("appRegistered", onRegister);

        emitRegister(conn, { applicationId: "app-a", pid: 1234 });

        expect(onRegister).toHaveBeenCalledWith({ applicationId: "app-a", pid: 1234 });
        expect(router.hasConnectedApps()).toBe(true);
        expect(router.getApps()).toEqual([{ applicationId: "app-a", pid: 1234 }]);
        expect(lastResponse(connections)).toEqual({ id: "req-1", result: { success: true } });
    });

    it("rejects registration with invalid params", () => {
        const { connections, router } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        router.on("appRegistered", onRegister);

        emitRegister(conn, { applicationId: "app-a" });

        expect(onRegister).not.toHaveBeenCalled();
        expect(router.hasConnectedApps()).toBe(false);
        const response = lastResponse(connections);
        expect(response?.error?.code).toBe(ErrorCode.INVALID_REQUEST);
    });

    it("replies with methodNotFound for unknown request methods", () => {
        const { connections } = ctx;
        const conn = makeConnection("c1");
        connections.emit("request", conn, { id: "req-1", method: "something.else" });
        const response = lastResponse(connections);
        expect(response?.id).toBe("req-1");
        expect(response?.error?.code).toBe(ErrorCode.METHOD_NOT_FOUND);
    });
});

describe("AppRouter registration — explicit unregister", () => {
    setupRouterContext();
    it("unregisters an app via app.unregister and emits appUnregistered", () => {
        const { connections, router } = ctx;
        const { conn, onUnregister } = registerWithUnregisterSpy();
        connections.emit("request", conn, { id: "req-2", method: "app.unregister" });

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(router.hasConnectedApps()).toBe(false);
        expect(lastResponse(connections)).toEqual({ id: "req-2", result: { success: true } });
    });

    it("ignores app.unregister from a connection that never registered", () => {
        const { connections, router } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = vi.fn();
        router.on("appUnregistered", onUnregister);

        connections.emit("request", conn, { id: "req-1", method: "app.unregister" });

        expect(onUnregister).not.toHaveBeenCalled();
        expect(lastResponse(connections)).toEqual({ id: "req-1", result: { success: true } });
    });
});

describe("AppRouter registration — disconnect", () => {
    setupRouterContext();
    it("removes the app when its connection disconnects", () => {
        const { connections, router } = ctx;
        const { conn, onUnregister } = registerWithUnregisterSpy();
        connections.emit("disconnection", conn);

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(router.hasConnectedApps()).toBe(false);
    });

    it("ignores disconnection from a connection without a registered app", () => {
        const { connections, router } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = vi.fn();
        router.on("appUnregistered", onUnregister);

        connections.emit("disconnection", conn);

        expect(onUnregister).not.toHaveBeenCalled();
    });
});

describe("AppRouter getDefaultApp", () => {
    setupRouterContext();
    it("returns undefined when no apps are connected", () => {
        expect(ctx.router.getDefaultApp()).toBeUndefined();
    });

    it("returns the first registered app", () => {
        const { router } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { applicationId: "app-a", pid: 1 });

        expect(router.getDefaultApp()?.info.applicationId).toBe("app-a");
    });
});

describe("AppRouter waitForApp", () => {
    setupRouterContext();
    it("resolves immediately when an app is already registered", async () => {
        const { router } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { applicationId: "app-a", pid: 1 });

        await expect(router.waitForApp()).resolves.toEqual({
            applicationId: "app-a",
            pid: 1,
        });
    });

    it("resolves once an app registers later", async () => {
        const { router } = ctx;
        const promise = router.waitForApp(5000);
        const conn = makeConnection("c1");

        emitRegister(conn, { applicationId: "app-late", pid: 99 });

        await expect(promise).resolves.toEqual({ applicationId: "app-late", pid: 99 });
    });

    it("rejects when no app registers before the timeout", async () => {
        const promise = ctx.router.waitForApp(1000);
        vi.advanceTimersByTime(1000);
        await expect(promise).rejects.toThrow(/Timeout waiting for app registration after 1000ms/);
    });
});

function registerAppForContext(applicationId: string, connectionId = "c1"): TestConnection {
    const conn = makeConnection(connectionId);
    emitRegister(conn, { applicationId, pid: 1 }, "reg");
    ctx.connections.sent.length = 0;
    return conn;
}

describe("AppRouter sendToApp — happy paths", () => {
    setupRouterContext();
    it("sends a request to the named app and resolves with the response result", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.router.sendToApp("app-a", "ping", { hello: "world" });
        const sent = lastOutgoingRequest(conn);

        conn.feed(`${JSON.stringify({ id: sent.id, result: { ok: true } })}\n`);

        await expect(promise).resolves.toEqual({ ok: true });
    });

    it("sends to the default app when applicationId is undefined", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.router.sendToApp(undefined, "ping");
        const sent = lastOutgoingRequest(conn);

        conn.feed(`${JSON.stringify({ id: sent.id, result: 42 })}\n`);

        await expect(promise).resolves.toBe(42);
    });

    it("ignores responses for unknown request ids", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.router.sendToApp("app-a", "ping");
        const sent = lastOutgoingRequest(conn);

        conn.feed(`${JSON.stringify({ id: "unknown", result: 1 })}\n`);
        conn.feed(`${JSON.stringify({ id: sent.id, result: 2 })}\n`);

        await expect(promise).resolves.toBe(2);
    });
});

describe("AppRouter sendToApp — lookup errors", () => {
    setupRouterContext();
    it("rejects with appNotFound when the named app is unknown", async () => {
        await expect(ctx.router.sendToApp("missing", "ping")).rejects.toMatchObject({
            code: ErrorCode.APP_NOT_FOUND,
        });
    });

    it("rejects with noAppConnected when no apps are registered and no applicationId given", async () => {
        await expect(ctx.router.sendToApp(undefined, "ping")).rejects.toMatchObject({
            code: ErrorCode.NO_APP_CONNECTED,
        });
    });
});

describe("AppRouter sendToApp — transport errors", () => {
    setupRouterContext();
    it("rejects with connectionWriteFailed and removes the app when the underlying send fails", async () => {
        const conn = registerAppForContext("app-a");
        const onUnregister = vi.fn();
        ctx.router.on("appUnregistered", onUnregister);
        conn.socket.destroy();

        await expect(ctx.router.sendToApp("app-a", "ping")).rejects.toMatchObject({
            code: ErrorCode.CONNECTION_WRITE_FAILED,
        });

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(ctx.router.hasConnectedApps()).toBe(false);
    });

    it("rejects with requestTimeout when no response arrives within the configured window", async () => {
        const customRouter = new AppRouter(ctx.connections, { requestTimeout: 5000 });
        const conn = makeConnection("c2");
        emitRegister(conn, { applicationId: "app-x", pid: 1 }, "reg");

        const promise = customRouter.sendToApp("app-x", "slow");
        vi.advanceTimersByTime(5000);

        await expect(promise).rejects.toMatchObject({ code: ErrorCode.REQUEST_TIMEOUT });
    });

    it("rejects with the ProtocolError described by an error response", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.router.sendToApp("app-a", "ping");
        const sent = lastOutgoingRequest(conn);

        conn.feed(
            `${JSON.stringify({
                id: sent.id,
                error: { code: ErrorCode.INTERNAL_ERROR, message: "boom", data: { reason: "x" } },
            })}\n`,
        );

        await expect(promise).rejects.toBeInstanceOf(ProtocolError);
        await expect(promise).rejects.toMatchObject({
            code: ErrorCode.INTERNAL_ERROR,
            message: "boom",
            data: { reason: "x" },
        });
    });
});

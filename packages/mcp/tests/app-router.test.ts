import { Duplex } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message, Request, Response } from "../src/protocol/schemas.js";
import { type AppRegisteredEvent, AppRouter, type AppUnregisteredEvent } from "../src/app-router.js";
import { ErrorCode, ProtocolError } from "../src/protocol/errors.js";
import {
    type AppConnections,
    connectionDisconnectionEvent,
    connectionRequestEvent,
    ProtocolConnection,
} from "../src/transport.js";

type TestConnection = ProtocolConnection & {
    socket: FakeSocket;
};

type RouterContext = {
    connections: FakeAppConnections;
    router: AppRouter;
};

type PingExchange = {
    conn: TestConnection;
    promise: Promise<unknown>;
    sent: Request;
};

const createdConnections: TestConnection[] = [];
const ctx = {} as RouterContext;

function makeConnection(id: string): TestConnection {
    const socket = new FakeSocket();
    const connection = new ProtocolConnection(socket) as TestConnection;
    connection.id = id;
    connection.socket = socket;
    createdConnections.push(connection);

    return connection;
}

function lastResponse(connections: FakeAppConnections): Response | undefined {
    const entry = connections.sent.at(-1);

    return entry?.message;
}

function lastOutgoingRequest(conn: TestConnection): Request {
    const line = conn.socket.lines.at(-1);

    if (!line) {
        throw new Error("No outgoing request captured");
    }

    return JSON.parse(line) as Request;
}

function emitRequest(conn: TestConnection, request: Request): void {
    ctx.connections.dispatchEvent(connectionRequestEvent(conn, request));
}

function emitDisconnection(conn: TestConnection): void {
    ctx.connections.dispatchEvent(connectionDisconnectionEvent(conn));
}

function emitRegister(
    conn: TestConnection,
    params: { applicationId: string; pid?: number; projectRoot?: string },
    id = "req-1",
): void {
    emitRequest(conn, { id, method: "app.register", params });
}

function onUnregistered(router: AppRouter): ReturnType<typeof vi.fn> {
    const listener = vi.fn();

    router.addEventListener("appUnregistered", (event) => {
        listener((event as AppUnregisteredEvent).detail);
    });

    return listener;
}

function onRegistered(router: AppRouter): ReturnType<typeof vi.fn> {
    const listener = vi.fn();

    router.addEventListener("appRegistered", (event) => {
        listener((event as AppRegisteredEvent).detail);
    });

    return listener;
}

function registerWithRegisterSpy(params: { applicationId: string; pid?: number }): ReturnType<typeof vi.fn> {
    const onRegister = onRegistered(ctx.router);
    emitRegister(makeConnection("c1"), params);

    return onRegister;
}

function registerWithUnregisterSpy(): { conn: TestConnection; onUnregister: ReturnType<typeof vi.fn> } {
    const conn = makeConnection("c1");
    const onUnregister = onUnregistered(ctx.router);
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

function registerAppForContext(applicationId: string, connectionId = "c1"): TestConnection {
    const conn = makeConnection(connectionId);
    emitRegister(conn, { applicationId, pid: 1 }, "reg");
    ctx.connections.sent.length = 0;

    return conn;
}

function sendPingRequest(applicationId: string | undefined, params?: unknown): PingExchange {
    const conn = registerAppForContext("app-a");
    const promise = ctx.router.sendToApp(applicationId, "ping", params);

    return { conn, promise, sent: lastOutgoingRequest(conn) };
}

class FakeSocket extends Duplex {
    lines: string[] = [];

    override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.lines.push(chunk.toString());
        callback();
    }
}

class FakeAppConnections extends EventTarget implements AppConnections {
    sent: { connectionId: string; message: Message }[] = [];

    send(connectionId: string, message: Message): void {
        this.sent.push({ connectionId, message });
    }
}

describe("AppRouter registration — basics", () => {
    setupRouterContext();

    it("registers an app and emits appRegistered with its info", () => {
        const { connections, router } = ctx;
        const onRegister = registerWithRegisterSpy({ applicationId: "app-a", pid: 1234 });
        expect(onRegister).toHaveBeenCalledWith({ applicationId: "app-a", pid: 1234 });
        expect(router.hasConnectedApps()).toBe(true);
        expect(router.getApps()).toEqual([{ applicationId: "app-a", pid: 1234 }]);
        expect(lastResponse(connections)).toEqual({ id: "req-1", result: { success: true } });
    });

    it("keeps the registered project root and exposes the default app's root", () => {
        const { router } = ctx;
        expect(router.getProjectRoot()).toBeUndefined();
        emitRegister(makeConnection("c1"), { applicationId: "app-a", pid: 1, projectRoot: "/projects/app-a" });
        emitRegister(makeConnection("c2"), { applicationId: "app-b", pid: 2, projectRoot: "/projects/app-b" }, "req-2");

        expect(router.getApps()).toEqual([
            { applicationId: "app-a", pid: 1, projectRoot: "/projects/app-a" },
            { applicationId: "app-b", pid: 2, projectRoot: "/projects/app-b" },
        ]);

        expect(router.getProjectRoot()).toBe("/projects/app-a");
    });

    it("registers without a project root and reports it as undefined", () => {
        const { router } = ctx;
        emitRegister(makeConnection("c1"), { applicationId: "app-a", pid: 1 });
        expect(router.getApps()).toEqual([{ applicationId: "app-a", pid: 1 }]);
        expect(router.getProjectRoot()).toBeUndefined();
    });

    it("rejects registration with invalid params", () => {
        const { connections, router } = ctx;
        const onRegister = registerWithRegisterSpy({ applicationId: "app-a" });
        expect(onRegister).not.toHaveBeenCalled();
        expect(router.hasConnectedApps()).toBe(false);
        const response = lastResponse(connections);
        expect(response?.error?.code).toBe(ErrorCode.INVALID_REQUEST);
    });

    it("replies with methodNotFound for unknown request methods", () => {
        const { connections } = ctx;
        const conn = makeConnection("c1");
        emitRequest(conn, { id: "req-1", method: "something.else" });
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
        emitRequest(conn, { id: "req-2", method: "app.unregister" });
        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(router.hasConnectedApps()).toBe(false);
        expect(lastResponse(connections)).toEqual({ id: "req-2", result: { success: true } });
    });

    it("ignores app.unregister from a connection that never registered", () => {
        const { connections, router } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = onUnregistered(router);
        emitRequest(conn, { id: "req-1", method: "app.unregister" });
        expect(onUnregister).not.toHaveBeenCalled();
        expect(lastResponse(connections)).toEqual({ id: "req-1", result: { success: true } });
    });
});

describe("AppRouter registration — disconnect", () => {
    setupRouterContext();

    it("removes the app when its connection disconnects", () => {
        const { router } = ctx;
        const { conn, onUnregister } = registerWithUnregisterSpy();
        emitDisconnection(conn);
        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(router.hasConnectedApps()).toBe(false);
    });

    it("ignores disconnection from a connection without a registered app", () => {
        const { router } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = onUnregistered(router);
        emitDisconnection(conn);
        expect(onUnregister).not.toHaveBeenCalled();
    });
});

describe("AppRouter getDefaultApp", () => {
    setupRouterContext();

    it("returns undefined when no apps are connected", () => {
        expect(ctx.router.getDefaultApp()).toBeUndefined();
    });

    it("returns the first registered app", () => {
        registerAppForContext("app-a");
        expect(ctx.router.getDefaultApp()?.info.applicationId).toBe("app-a");
    });
});

describe("AppRouter waitForApp", () => {
    setupRouterContext();

    it("resolves immediately when an app is already registered", async () => {
        registerAppForContext("app-a");

        await expect(ctx.router.waitForApp()).resolves.toEqual({
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

describe("AppRouter sendToApp — happy paths", () => {
    setupRouterContext();

    it("sends a request to the named app and resolves with the response result", async () => {
        const { conn, promise, sent } = sendPingRequest("app-a", { hello: "world" });
        conn.feed(`${JSON.stringify({ id: sent.id, result: { ok: true } })}\n`);
        await expect(promise).resolves.toEqual({ ok: true });
    });

    it("sends to the default app when applicationId is undefined", async () => {
        const { conn, promise, sent } = sendPingRequest(undefined);
        conn.feed(`${JSON.stringify({ id: sent.id, result: 42 })}\n`);
        await expect(promise).resolves.toBe(42);
    });

    it("ignores responses for unknown request ids", async () => {
        const { conn, promise, sent } = sendPingRequest("app-a");
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
        const onUnregister = onUnregistered(ctx.router);
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
        const { conn, promise, sent } = sendPingRequest("app-a");

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

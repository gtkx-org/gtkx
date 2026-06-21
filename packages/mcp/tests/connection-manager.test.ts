import EventEmitter from "node:events";
import { Duplex } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionManager } from "../src/connection-manager.js";
import { McpError, McpErrorCode } from "../src/protocol/errors.js";
import type { IpcMessage, IpcRequest, IpcResponse } from "../src/protocol/types.js";
import {
    type AppConnection,
    type AppTransport,
    type AppTransportEvents,
    JsonStreamTransport,
} from "../src/transport.js";

class FakeSocket extends Duplex {
    lines: string[] = [];

    override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.lines.push(chunk.toString());
        callback();
    }
}

type TestConnection = AppConnection & {
    socket: FakeSocket;
};

const createdConnections: TestConnection[] = [];

function makeConnection(id: string): TestConnection {
    const socket = new FakeSocket();
    const transport = new JsonStreamTransport(socket);
    const connection: TestConnection = { id, transport, socket };
    createdConnections.push(connection);
    return connection;
}

class FakeAppTransport extends EventEmitter<AppTransportEvents> implements AppTransport {
    sent: Array<{ connectionId: string; message: IpcMessage }> = [];

    send(connectionId: string, message: IpcMessage): void {
        this.sent.push({ connectionId, message });
    }
}

function lastResponse(transport: FakeAppTransport): IpcResponse | undefined {
    const entry = transport.sent[transport.sent.length - 1];
    return entry?.message as IpcResponse | undefined;
}

function lastOutgoingRequest(conn: TestConnection): IpcRequest {
    const line = conn.socket.lines[conn.socket.lines.length - 1];
    if (!line) throw new Error("No outgoing request captured");
    return JSON.parse(line) as IpcRequest;
}

interface ManagerContext {
    transport: FakeAppTransport;
    manager: ConnectionManager;
}

const ctx = {} as ManagerContext;

function emitRegister(conn: TestConnection, params: { applicationId: string; pid?: number }, id = "req-1"): void {
    ctx.transport.emit("request", conn, { id, method: "app.register", params });
}

function registerWithUnregisterSpy(): { conn: TestConnection; onUnregister: ReturnType<typeof vi.fn> } {
    const conn = makeConnection("c1");
    const onUnregister = vi.fn();
    ctx.manager.on("appUnregistered", onUnregister);
    emitRegister(conn, { applicationId: "app-a", pid: 1 });
    return { conn, onUnregister };
}

function setupManagerContext(): void {
    beforeEach(() => {
        vi.useFakeTimers();
        createdConnections.length = 0;
        ctx.transport = new FakeAppTransport();
        ctx.manager = new ConnectionManager(ctx.transport);
    });
    afterEach(() => {
        for (const connection of createdConnections) {
            connection.transport.rejectPending(new Error("test teardown"));
        }
        vi.useRealTimers();
    });
}

describe("ConnectionManager registration — basics", () => {
    setupManagerContext();
    it("registers an app and emits appRegistered with its info", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        manager.on("appRegistered", onRegister);

        emitRegister(conn, { applicationId: "app-a", pid: 1234 });

        expect(onRegister).toHaveBeenCalledWith({ applicationId: "app-a", pid: 1234 });
        expect(manager.hasConnectedApps()).toBe(true);
        expect(manager.getApps()).toEqual([{ applicationId: "app-a", pid: 1234 }]);
        expect(lastResponse(transport)).toEqual({ id: "req-1", result: { success: true } });
    });

    it("rejects registration with invalid params", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        manager.on("appRegistered", onRegister);

        emitRegister(conn, { applicationId: "app-a" });

        expect(onRegister).not.toHaveBeenCalled();
        expect(manager.hasConnectedApps()).toBe(false);
        const response = lastResponse(transport);
        expect(response?.error?.code).toBe(McpErrorCode.INVALID_REQUEST);
    });

    it("replies with methodNotFound for unknown request methods", () => {
        const { transport } = ctx;
        const conn = makeConnection("c1");
        transport.emit("request", conn, { id: "req-1", method: "something.else" });
        const response = lastResponse(transport);
        expect(response?.id).toBe("req-1");
        expect(response?.error?.code).toBe(McpErrorCode.METHOD_NOT_FOUND);
    });
});

describe("ConnectionManager registration — explicit unregister", () => {
    setupManagerContext();
    it("unregisters an app via app.unregister and emits appUnregistered", () => {
        const { transport, manager } = ctx;
        const { conn, onUnregister } = registerWithUnregisterSpy();
        transport.emit("request", conn, { id: "req-2", method: "app.unregister" });

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(manager.hasConnectedApps()).toBe(false);
        expect(lastResponse(transport)).toEqual({ id: "req-2", result: { success: true } });
    });

    it("ignores app.unregister from a connection that never registered", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = vi.fn();
        manager.on("appUnregistered", onUnregister);

        transport.emit("request", conn, { id: "req-1", method: "app.unregister" });

        expect(onUnregister).not.toHaveBeenCalled();
        expect(lastResponse(transport)).toEqual({ id: "req-1", result: { success: true } });
    });
});

describe("ConnectionManager registration — disconnect", () => {
    setupManagerContext();
    it("removes the app when its connection disconnects", () => {
        const { transport, manager } = ctx;
        const { conn, onUnregister } = registerWithUnregisterSpy();
        transport.emit("disconnection", conn);

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(manager.hasConnectedApps()).toBe(false);
    });

    it("ignores disconnection from a connection without a registered app", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onUnregister = vi.fn();
        manager.on("appUnregistered", onUnregister);

        transport.emit("disconnection", conn);

        expect(onUnregister).not.toHaveBeenCalled();
    });
});

describe("ConnectionManager getDefaultApp", () => {
    setupManagerContext();
    it("returns undefined when no apps are connected", () => {
        expect(ctx.manager.getDefaultApp()).toBeUndefined();
    });

    it("returns the first registered app", () => {
        const { manager } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { applicationId: "app-a", pid: 1 });

        expect(manager.getDefaultApp()?.info.applicationId).toBe("app-a");
    });
});

describe("ConnectionManager waitForApp", () => {
    setupManagerContext();
    it("resolves immediately when an app is already registered", async () => {
        const { manager } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { applicationId: "app-a", pid: 1 });

        await expect(manager.waitForApp()).resolves.toEqual({
            applicationId: "app-a",
            pid: 1,
        });
    });

    it("resolves once an app registers later", async () => {
        const { manager } = ctx;
        const promise = manager.waitForApp(5000);
        const conn = makeConnection("c1");

        emitRegister(conn, { applicationId: "app-late", pid: 99 });

        await expect(promise).resolves.toEqual({ applicationId: "app-late", pid: 99 });
    });

    it("rejects when no app registers before the timeout", async () => {
        const promise = ctx.manager.waitForApp(1000);
        vi.advanceTimersByTime(1000);
        await expect(promise).rejects.toThrow(/Timeout waiting for app registration after 1000ms/);
    });
});

function registerAppForContext(applicationId: string, connectionId = "c1"): TestConnection {
    const conn = makeConnection(connectionId);
    emitRegister(conn, { applicationId, pid: 1 }, "reg");
    ctx.transport.sent.length = 0;
    return conn;
}

describe("ConnectionManager sendToApp — happy paths", () => {
    setupManagerContext();
    it("sends a request to the named app and resolves with the response result", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.manager.sendToApp("app-a", "ping", { hello: "world" });
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: { ok: true } })}\n`);

        await expect(promise).resolves.toEqual({ ok: true });
    });

    it("sends to the default app when applicationId is undefined", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.manager.sendToApp(undefined, "ping");
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: 42 })}\n`);

        await expect(promise).resolves.toBe(42);
    });

    it("ignores responses for unknown request ids", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.manager.sendToApp("app-a", "ping");
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: "unknown", result: 1 })}\n`);
        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: 2 })}\n`);

        await expect(promise).resolves.toBe(2);
    });
});

describe("ConnectionManager sendToApp — lookup errors", () => {
    setupManagerContext();
    it("rejects with appNotFound when the named app is unknown", async () => {
        await expect(ctx.manager.sendToApp("missing", "ping")).rejects.toMatchObject({
            code: McpErrorCode.APP_NOT_FOUND,
        });
    });

    it("rejects with noAppConnected when no apps are registered and no applicationId given", async () => {
        await expect(ctx.manager.sendToApp(undefined, "ping")).rejects.toMatchObject({
            code: McpErrorCode.NO_APP_CONNECTED,
        });
    });
});

describe("ConnectionManager sendToApp — transport errors", () => {
    setupManagerContext();
    it("rejects with connectionWriteFailed and removes the app when the underlying send fails", async () => {
        const conn = registerAppForContext("app-a");
        const onUnregister = vi.fn();
        ctx.manager.on("appUnregistered", onUnregister);
        conn.socket.destroy();

        await expect(ctx.manager.sendToApp("app-a", "ping")).rejects.toMatchObject({
            code: McpErrorCode.CONNECTION_WRITE_FAILED,
        });

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(ctx.manager.hasConnectedApps()).toBe(false);
    });

    it("rejects with ipcTimeout when no response arrives within the configured window", async () => {
        const customManager = new ConnectionManager(ctx.transport, { requestTimeout: 5000 });
        const conn = makeConnection("c2");
        emitRegister(conn, { applicationId: "app-x", pid: 1 }, "reg");

        const promise = customManager.sendToApp("app-x", "slow");
        vi.advanceTimersByTime(5000);

        await expect(promise).rejects.toMatchObject({ code: McpErrorCode.IPC_TIMEOUT });
    });

    it("rejects with the McpError described by an error response", async () => {
        const conn = registerAppForContext("app-a");
        const promise = ctx.manager.sendToApp("app-a", "ping");
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(
            `${JSON.stringify({
                id: sent.id,
                error: { code: McpErrorCode.INTERNAL_ERROR, message: "boom", data: { reason: "x" } },
            })}\n`,
        );

        await expect(promise).rejects.toBeInstanceOf(McpError);
        await expect(promise).rejects.toMatchObject({
            code: McpErrorCode.INTERNAL_ERROR,
            message: "boom",
            data: { reason: "x" },
        });
    });
});

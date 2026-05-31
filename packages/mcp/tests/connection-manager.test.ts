import EventEmitter from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionManager } from "../src/connection-manager.js";
import { McpError, McpErrorCode } from "../src/protocol/errors.js";
import type { IpcMessage, IpcRequest, IpcResponse } from "../src/protocol/types.js";
import {
    type AppConnection,
    type AppTransport,
    type AppTransportEvents,
    type FrameWriter,
    JsonStreamTransport,
} from "../src/transport.js";

type TestConnection = AppConnection & {
    capture: { lines: string[]; writable: boolean };
};

function makeConnection(id: string): TestConnection {
    const capture = { lines: [] as string[], writable: true };
    const writer: FrameWriter = {
        write(line) {
            capture.lines.push(line);
            return true;
        },
        get writable() {
            return capture.writable;
        },
    };
    const transport = new JsonStreamTransport(writer);
    return { id, transport, capture };
}

class FakeAppTransport extends EventEmitter<AppTransportEvents> implements AppTransport {
    readonly sent: Array<{ connectionId: string; message: IpcMessage }> = [];

    send(connectionId: string, message: IpcMessage): void {
        this.sent.push({ connectionId, message });
    }
}

function lastResponse(transport: FakeAppTransport): IpcResponse | undefined {
    const entry = transport.sent[transport.sent.length - 1];
    return entry?.message as IpcResponse | undefined;
}

function lastOutgoingRequest(conn: TestConnection): IpcRequest {
    const line = conn.capture.lines[conn.capture.lines.length - 1];
    if (!line) throw new Error("No outgoing request captured");
    return JSON.parse(line) as IpcRequest;
}

interface ManagerCtx {
    transport: FakeAppTransport;
    manager: ConnectionManager;
}

const ctx = {} as ManagerCtx;

/**
 * Emits an `app.register` request for the given connection on the shared
 * context transport, leaving the recorded `sent` messages untouched.
 *
 * @param conn - Connection the request originates from.
 * @param params - Registration parameters, where `pid` may be omitted to
 *   exercise validation failures.
 * @param id - Request id carried by the emitted message.
 */
function emitRegister(conn: TestConnection, params: { appId: string; pid?: number }, id = "req-1"): void {
    ctx.transport.emit("request", conn, { id, method: "app.register", params });
}

/**
 * Creates a connection, attaches a fresh spy to the manager's
 * `appUnregistered` event, and registers `app-a` from that connection.
 *
 * @returns The created connection and the attached unregister spy.
 */
function registerWithUnregisterSpy(): { conn: TestConnection; onUnregister: ReturnType<typeof vi.fn> } {
    const conn = makeConnection("c1");
    const onUnregister = vi.fn();
    ctx.manager.on("appUnregistered", onUnregister);
    emitRegister(conn, { appId: "app-a", pid: 1 });
    return { conn, onUnregister };
}

function setupManagerCtx(): void {
    beforeEach(() => {
        vi.useFakeTimers();
        ctx.transport = new FakeAppTransport();
        ctx.manager = new ConnectionManager(ctx.transport);
    });
    afterEach(() => {
        ctx.manager.cleanup();
        vi.useRealTimers();
    });
}

describe("ConnectionManager registration — basics", () => {
    setupManagerCtx();
    it("registers an app and emits appRegistered with its info", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        manager.on("appRegistered", onRegister);

        emitRegister(conn, { appId: "app-a", pid: 1234 });

        expect(onRegister).toHaveBeenCalledWith({ appId: "app-a", pid: 1234, windows: [] });
        expect(manager.hasConnectedApps()).toBe(true);
        expect(manager.getApps()).toEqual([{ appId: "app-a", pid: 1234, windows: [] }]);
        expect(lastResponse(transport)).toEqual({ id: "req-1", result: { success: true } });
    });

    it("rejects registration with invalid params", () => {
        const { transport, manager } = ctx;
        const conn = makeConnection("c1");
        const onRegister = vi.fn();
        manager.on("appRegistered", onRegister);

        emitRegister(conn, { appId: "app-a" });

        expect(onRegister).not.toHaveBeenCalled();
        expect(manager.hasConnectedApps()).toBe(false);
        const response = lastResponse(transport);
        expect(response?.error?.code).toBe(McpErrorCode.INVALID_REQUEST);
    });

    it("ignores unknown request methods on the manager event channel", () => {
        const { transport } = ctx;
        const conn = makeConnection("c1");
        transport.emit("request", conn, { id: "req-1", method: "something.else" });
        expect(transport.sent).toEqual([]);
    });
});

describe("ConnectionManager registration — explicit unregister", () => {
    setupManagerCtx();
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
    setupManagerCtx();
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
    setupManagerCtx();
    it("returns undefined when no apps are connected", () => {
        expect(ctx.manager.getDefaultApp()).toBeUndefined();
    });

    it("returns the first registered app", () => {
        const { manager } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { appId: "app-a", pid: 1 });

        expect(manager.getDefaultApp()?.info.appId).toBe("app-a");
    });
});

describe("ConnectionManager waitForApp", () => {
    setupManagerCtx();
    it("resolves immediately when an app is already registered", async () => {
        const { manager } = ctx;
        const conn = makeConnection("c1");
        emitRegister(conn, { appId: "app-a", pid: 1 });

        await expect(manager.waitForApp()).resolves.toEqual({
            appId: "app-a",
            pid: 1,
            windows: [],
        });
    });

    it("resolves once an app registers later", async () => {
        const { manager } = ctx;
        const promise = manager.waitForApp(5000);
        const conn = makeConnection("c1");

        emitRegister(conn, { appId: "app-late", pid: 99 });

        await expect(promise).resolves.toEqual({ appId: "app-late", pid: 99, windows: [] });
    });

    it("rejects when no app registers before the timeout", async () => {
        const promise = ctx.manager.waitForApp(1000);
        vi.advanceTimersByTime(1000);
        await expect(promise).rejects.toThrow(/Timeout waiting for app registration after 1000ms/);
    });
});

function registerAppForCtx(appId: string, connectionId = "c1"): TestConnection {
    const conn = makeConnection(connectionId);
    emitRegister(conn, { appId, pid: 1 }, "reg");
    ctx.transport.sent.length = 0;
    return conn;
}

describe("ConnectionManager sendToApp — happy paths", () => {
    setupManagerCtx();
    it("sends a request to the named app and resolves with the response result", async () => {
        const conn = registerAppForCtx("app-a");
        const promise = ctx.manager.sendToApp("app-a", "ping", { hello: "world" });
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: { ok: true } })}\n`);

        await expect(promise).resolves.toEqual({ ok: true });
    });

    it("sends to the default app when appId is undefined", async () => {
        const conn = registerAppForCtx("app-a");
        const promise = ctx.manager.sendToApp(undefined, "ping");
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: 42 })}\n`);

        await expect(promise).resolves.toBe(42);
    });

    it("ignores responses for unknown request ids", async () => {
        const conn = registerAppForCtx("app-a");
        const promise = ctx.manager.sendToApp("app-a", "ping");
        const sent = lastOutgoingRequest(conn);

        conn.transport.feed(`${JSON.stringify({ id: "unknown", result: 1 })}\n`);
        conn.transport.feed(`${JSON.stringify({ id: sent.id, result: 2 })}\n`);

        await expect(promise).resolves.toBe(2);
    });
});

describe("ConnectionManager sendToApp — lookup errors", () => {
    setupManagerCtx();
    it("rejects with appNotFound when the named app is unknown", async () => {
        await expect(ctx.manager.sendToApp("missing", "ping")).rejects.toMatchObject({
            code: McpErrorCode.APP_NOT_FOUND,
        });
    });

    it("rejects with noAppConnected when no apps are registered and no appId given", async () => {
        await expect(ctx.manager.sendToApp(undefined, "ping")).rejects.toMatchObject({
            code: McpErrorCode.NO_APP_CONNECTED,
        });
    });
});

describe("ConnectionManager sendToApp — transport errors", () => {
    setupManagerCtx();
    it("rejects with connectionWriteFailed and removes the app when the underlying send fails", async () => {
        const conn = registerAppForCtx("app-a");
        const onUnregister = vi.fn();
        ctx.manager.on("appUnregistered", onUnregister);
        conn.capture.writable = false;

        await expect(ctx.manager.sendToApp("app-a", "ping")).rejects.toMatchObject({
            code: McpErrorCode.CONNECTION_WRITE_FAILED,
        });

        expect(onUnregister).toHaveBeenCalledWith("app-a");
        expect(ctx.manager.hasConnectedApps()).toBe(false);
    });

    it("rejects with ipcTimeout when no response arrives within the configured window", async () => {
        const customManager = new ConnectionManager(ctx.transport, { requestTimeout: 5000 });
        const conn = makeConnection("c2");
        emitRegister(conn, { appId: "app-x", pid: 1 }, "reg");

        const promise = customManager.sendToApp("app-x", "slow");
        vi.advanceTimersByTime(5000);

        await expect(promise).rejects.toMatchObject({ code: McpErrorCode.IPC_TIMEOUT });
        customManager.cleanup();
    });

    it("rejects with the McpError described by an error response", async () => {
        const conn = registerAppForCtx("app-a");
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

describe("ConnectionManager cleanup", () => {
    setupManagerCtx();
    it("rejects all pending requests with a shutdown error", async () => {
        const conn = registerAppForCtx("app-a");

        const promise = ctx.manager.sendToApp("app-a", "ping");
        expect(conn.capture.lines.length).toBeGreaterThan(0);
        ctx.manager.cleanup();

        await expect(promise).rejects.toThrow("Connection manager shutting down");
    });
});

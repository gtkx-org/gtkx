import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionManager } from "../src/connection-manager.js";
import type { AppInfo } from "../src/protocol/types.js";

const { mcpServerInstances, registerToolMock, mcpConnectMock, mcpCloseMock } = vi.hoisted(() => {
    const instances: Array<{ name: string; version: string }> = [];
    return {
        mcpServerInstances: instances,
        registerToolMock: vi.fn(),
        mcpConnectMock: vi.fn(async () => undefined),
        mcpCloseMock: vi.fn(async () => undefined),
    };
});

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
    McpServer: class {
        constructor(opts: { name: string; version: string }) {
            mcpServerInstances.push(opts);
        }
        registerTool(name: string, config: unknown, handler: unknown): void {
            registerToolMock(name, config, handler);
        }
        connect = mcpConnectMock;
        close = mcpCloseMock;
    },
}));

const { stdioInstances } = vi.hoisted(() => ({ stdioInstances: [] as object[] }));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
    StdioServerTransport: class {
        constructor() {
            stdioInstances.push(this);
        }
    },
}));

const { socketStartMock, socketStopMock, socketServerInstances } = vi.hoisted(() => ({
    socketStartMock: vi.fn(async () => undefined),
    socketStopMock: vi.fn(async () => undefined),
    socketServerInstances: [] as Array<
        EventEmitter & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }
    >,
}));

vi.mock("../src/socket-server.js", () => ({
    SocketServer: class extends EventEmitter {
        start = socketStartMock;
        stop = socketStopMock;
        constructor(_path: string) {
            super();
            socketServerInstances.push(
                this as EventEmitter & { start: typeof socketStartMock; stop: typeof socketStopMock },
            );
        }
    },
}));

const { connectionManagerInstances, cleanupMock } = vi.hoisted(() => ({
    connectionManagerInstances: [] as Array<EventEmitter & { cleanup: ReturnType<typeof vi.fn> }>,
    cleanupMock: vi.fn(),
}));

vi.mock("../src/connection-manager.js", () => ({
    ConnectionManager: class extends EventEmitter {
        cleanup = cleanupMock;
        constructor(_socketServer: unknown) {
            super();
            connectionManagerInstances.push(this as EventEmitter & { cleanup: typeof cleanupMock });
        }
    },
}));

import { buildTools, main } from "../src/cli.js";

type AppQueryClient = Pick<ConnectionManager, "getApps" | "hasConnectedApps" | "waitForApp" | "sendToApp">;

function makeConnectionManager(overrides: Partial<AppQueryClient> = {}): AppQueryClient {
    return {
        getApps: vi.fn(() => []),
        hasConnectedApps: vi.fn(() => false),
        waitForApp: vi.fn(async () => ({ appId: "app-a", pid: 1, windows: [] }) as AppInfo),
        sendToApp: vi.fn(async () => ({}) as never),
        ...overrides,
    };
}

function getTool(connectionManager: AppQueryClient, name: string) {
    const tools = buildTools(connectionManager);
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
}

const allToolNames = [
    "gtkx_list_apps",
    "gtkx_get_widget_tree",
    "gtkx_query_widgets",
    "gtkx_get_widget_props",
    "gtkx_click",
    "gtkx_type",
    "gtkx_fire_event",
    "gtkx_take_screenshot",
];

describe("buildTools", () => {
    it("registers all expected tools in order", () => {
        const tools = buildTools(makeConnectionManager());
        expect(tools.map((t) => t.name)).toEqual(allToolNames);
    });

    it("attaches a description and inputSchema to every tool", () => {
        const tools = buildTools(makeConnectionManager());
        for (const tool of tools) {
            expect(tool.config.description.length).toBeGreaterThan(0);
            expect(tool.config.inputSchema).toBeDefined();
        }
    });

    describe("gtkx_list_apps", () => {
        it("returns connected apps with their windows", async () => {
            const apps: AppInfo[] = [{ appId: "app-a", pid: 1, windows: [] }];
            const sendToApp = vi.fn(async () => ({
                windows: [{ id: "w1", title: "Main" }],
            }));
            const cm = makeConnectionManager({
                getApps: vi.fn(() => apps),
                hasConnectedApps: vi.fn(() => true),
                sendToApp: sendToApp as never,
            });

            const result = await getTool(cm, "gtkx_list_apps").handler({} as never);

            expect(sendToApp).toHaveBeenCalledWith("app-a", "app.getWindows", {});
            expect(result.content[0]).toMatchObject({ type: "text" });
            const text = result.content[0] as { type: "text"; text: string };
            expect(JSON.parse(text.text)).toEqual([{ appId: "app-a", pid: 1, windows: [{ id: "w1", title: "Main" }] }]);
        });

        it("falls back to the original app info when getWindows fails", async () => {
            const apps: AppInfo[] = [{ appId: "app-a", pid: 1, windows: [] }];
            const cm = makeConnectionManager({
                getApps: vi.fn(() => apps),
                hasConnectedApps: vi.fn(() => true),
                sendToApp: vi.fn(async () => {
                    throw new Error("boom");
                }) as never,
            });

            const result = await getTool(cm, "gtkx_list_apps").handler({} as never);
            const text = result.content[0] as { type: "text"; text: string };
            expect(JSON.parse(text.text)).toEqual(apps);
        });

        it("waits for an app when waitForApps is true and none are connected", async () => {
            const waitForApp = vi.fn(async () => ({ appId: "app-a", pid: 1, windows: [] }) as AppInfo);
            const cm = makeConnectionManager({
                hasConnectedApps: vi.fn(() => false),
                waitForApp: waitForApp as never,
            });

            await getTool(cm, "gtkx_list_apps").handler({ waitForApps: true, timeout: 5000 } as never);

            expect(waitForApp).toHaveBeenCalledWith(5000);
        });

        it("returns an error result when waitForApp times out", async () => {
            const cm = makeConnectionManager({
                hasConnectedApps: vi.fn(() => false),
                waitForApp: vi.fn(async () => {
                    throw new Error("Timeout waiting for app registration");
                }) as never,
            });

            const result = await getTool(cm, "gtkx_list_apps").handler({ waitForApps: true } as never);

            expect(result.isError).toBe(true);
            const text = result.content[0] as { type: "text"; text: string };
            expect(text.text).toContain("Timeout");
        });

        it("returns a generic error message when waitForApp throws a non-Error", async () => {
            const cm = makeConnectionManager({
                hasConnectedApps: vi.fn(() => false),
                waitForApp: vi.fn(async () => {
                    throw "not an Error";
                }) as never,
            });

            const result = await getTool(cm, "gtkx_list_apps").handler({ waitForApps: true } as never);

            expect(result.isError).toBe(true);
            const text = result.content[0] as { type: "text"; text: string };
            expect(text.text).toBe("Timeout waiting for app");
        });

        it("does not call waitForApp when apps are already connected", async () => {
            const waitForApp = vi.fn();
            const cm = makeConnectionManager({
                hasConnectedApps: vi.fn(() => true),
                waitForApp: waitForApp as never,
            });

            await getTool(cm, "gtkx_list_apps").handler({ waitForApps: true } as never);

            expect(waitForApp).not.toHaveBeenCalled();
        });
    });

    describe("gtkx_get_widget_tree", () => {
        it("forwards appId and returns the tree string", async () => {
            const sendToApp = vi.fn(async () => ({ tree: "TREE" }));
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_get_widget_tree").handler({ appId: "app-a" } as never);

            expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.getTree", {});
            expect(result.content[0]).toEqual({ type: "text", text: "TREE" });
        });
    });

    describe("gtkx_query_widgets", () => {
        it("forwards query parameters and returns serialized result", async () => {
            const sendToApp = vi.fn(async () => ({ widgets: [{ id: "w1" }] }));
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_query_widgets").handler({
                appId: "app-a",
                by: "role",
                value: "button",
                options: { exact: true },
            } as never);

            expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.query", {
                queryType: "role",
                value: "button",
                options: { exact: true },
            });
            const text = result.content[0] as { type: "text"; text: string };
            expect(JSON.parse(text.text)).toEqual({ widgets: [{ id: "w1" }] });
        });
    });

    describe("gtkx_get_widget_props", () => {
        it("returns props serialized as JSON", async () => {
            const sendToApp = vi.fn(async () => ({ label: "Click me" }));
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_get_widget_props").handler({
                appId: "app-a",
                widgetId: "w1",
            } as never);

            expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.getProps", { widgetId: "w1" });
            const text = result.content[0] as { type: "text"; text: string };
            expect(JSON.parse(text.text)).toEqual({ label: "Click me" });
        });
    });

    describe("gtkx_click", () => {
        it("sends a widget.click and returns a confirmation message", async () => {
            const sendToApp = vi.fn(async () => undefined);
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_click").handler({ widgetId: "w1" } as never);

            expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.click", { widgetId: "w1" });
            expect(result.content[0]).toEqual({ type: "text", text: "Click successful" });
        });
    });

    describe("gtkx_type", () => {
        it("forwards text and clear flag", async () => {
            const sendToApp = vi.fn(async () => undefined);
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_type").handler({
                widgetId: "w1",
                text: "hello",
                clear: true,
            } as never);

            expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.type", {
                widgetId: "w1",
                text: "hello",
                clear: true,
            });
            expect(result.content[0]).toEqual({ type: "text", text: "Type successful" });
        });
    });

    describe("gtkx_fire_event", () => {
        it("forwards signal name and args", async () => {
            const sendToApp = vi.fn(async () => undefined);
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_fire_event").handler({
                widgetId: "w1",
                signal: "clicked",
                args: ["arg1"],
            } as never);

            expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.fireEvent", {
                widgetId: "w1",
                signal: "clicked",
                args: ["arg1"],
            });
            expect(result.content[0]).toEqual({ type: "text", text: "Event fired successfully" });
        });
    });

    describe("gtkx_take_screenshot", () => {
        it("returns image content from the response", async () => {
            const sendToApp = vi.fn(async () => ({ data: "BASE64", mimeType: "image/png" }));
            const cm = makeConnectionManager({ sendToApp: sendToApp as never });

            const result = await getTool(cm, "gtkx_take_screenshot").handler({
                appId: "app-a",
                windowId: "w-main",
            } as never);

            expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.screenshot", { windowId: "w-main" });
            expect(result.content[0]).toEqual({ type: "image", data: "BASE64", mimeType: "image/png" });
        });
    });
});

describe("main", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let prevSigInt: ReturnType<typeof process.listeners>;
    let prevSigTerm: ReturnType<typeof process.listeners>;

    beforeEach(() => {
        mcpServerInstances.length = 0;
        registerToolMock.mockClear();
        mcpConnectMock.mockClear();
        mcpCloseMock.mockClear();
        socketStartMock.mockClear();
        socketStopMock.mockClear();
        cleanupMock.mockClear();
        socketServerInstances.length = 0;
        connectionManagerInstances.length = 0;
        stdioInstances.length = 0;

        errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        prevSigInt = process.listeners("SIGINT");
        prevSigTerm = process.listeners("SIGTERM");
    });

    afterEach(() => {
        errorSpy.mockRestore();
        exitSpy.mockRestore();
        for (const listener of process.listeners("SIGINT")) {
            if (!prevSigInt.includes(listener)) process.removeListener("SIGINT", listener as never);
        }
        for (const listener of process.listeners("SIGTERM")) {
            if (!prevSigTerm.includes(listener)) process.removeListener("SIGTERM", listener as never);
        }
    });

    it("starts the socket server, registers all tools, and connects the MCP server", async () => {
        await main();

        expect(socketStartMock).toHaveBeenCalledOnce();
        expect(mcpServerInstances).toHaveLength(1);
        expect(mcpServerInstances[0]?.name).toBe("gtkx-mcp");
        expect(registerToolMock).toHaveBeenCalledTimes(allToolNames.length);
        expect(mcpConnectMock).toHaveBeenCalledOnce();
        expect(stdioInstances).toHaveLength(1);
    });

    it("logs broken-pipe-style socket errors only when the code is not EPIPE/ECONNRESET", async () => {
        await main();
        const socket = socketServerInstances[0];
        if (!socket) throw new Error("Socket not registered");

        socket.emit("error", Object.assign(new Error("pipe gone"), { code: "EPIPE" }));
        socket.emit("error", Object.assign(new Error("conn gone"), { code: "ECONNRESET" }));
        socket.emit("error", Object.assign(new Error("real boom"), { code: "EACCES" }));

        const messages = errorSpy.mock.calls.map((c: unknown[]) => String(c[1] ?? c[0]));
        expect(messages.filter((m: string) => m.includes("real boom"))).toHaveLength(1);
        expect(messages.some((m: string) => m.includes("pipe gone"))).toBe(false);
        expect(messages.some((m: string) => m.includes("conn gone"))).toBe(false);
    });

    it("logs an entry when an app registers and unregisters", async () => {
        await main();
        const cm = connectionManagerInstances[0];
        if (!cm) throw new Error("ConnectionManager not registered");

        cm.emit("appRegistered", { appId: "app-a", pid: 42 });
        cm.emit("appUnregistered", "app-a");

        const messages = errorSpy.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(messages.some((m: string) => m.includes("App registered: app-a (PID: 42)"))).toBe(true);
        expect(messages.some((m: string) => m.includes("App unregistered: app-a"))).toBe(true);
    });

    it("shuts down on SIGINT, cleaning up resources exactly once", async () => {
        await main();

        process.emit("SIGINT", "SIGINT");
        await new Promise((r) => setImmediate(r));

        expect(cleanupMock).toHaveBeenCalledOnce();
        expect(socketStopMock).toHaveBeenCalledOnce();
        expect(mcpCloseMock).toHaveBeenCalledOnce();
        expect(exitSpy).toHaveBeenCalledWith(0);

        process.emit("SIGTERM", "SIGTERM");
        await new Promise((r) => setImmediate(r));

        expect(cleanupMock).toHaveBeenCalledOnce();
        expect(socketStopMock).toHaveBeenCalledOnce();
    });
});

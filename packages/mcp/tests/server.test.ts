import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRouter } from "../src/app-router.js";
import type { AppInfo } from "../src/protocol/schemas.js";
import { appRegisteredEvent, appUnregisteredEvent } from "../src/app-router.js";
import { createMcpServer, main } from "../src/server.js";
import { connectionErrorEvent } from "../src/transport.js";

type AppRouterStub = Pick<AppRouter, "getApps" | "hasConnectedApps" | "waitForApp" | "sendToApp">;

type RegisteredTool = {
    name: string;
    config: { description: string; inputSchema: unknown };
    handler: (args: never) => Promise<CallToolResult>;
};

type WidgetActionRun = {
    sendToApp: ReturnType<typeof vi.fn>;
    result: CallToolResult;
};

type MainSetup = {
    errorSpy: MockInstance<typeof process.stderr.write>;
    exitSpy: MockInstance<typeof process.exit>;
    prevSigInt: ((signal: "SIGINT") => void)[];
    prevSigTerm: ((signal: "SIGTERM") => void)[];
};

const { mcpServerInstances, registerToolMock, registerResourceMock, mcpConnectMock, mcpCloseMock } = vi.hoisted(() => {
    const instances: { name: string; version: string }[] = [];

    return {
        mcpServerInstances: instances,
        registerToolMock: vi.fn(),
        registerResourceMock: vi.fn(),
        mcpConnectMock: vi.fn(),
        mcpCloseMock: vi.fn(),
    };
});

const { stdioInstances } = vi.hoisted(() => ({ stdioInstances: [] as object[] }));

const { socketStartMock, socketStopMock, socketServerInstances } = vi.hoisted(() => ({
    socketStartMock: vi.fn(),
    socketStopMock: vi.fn(),
    socketServerInstances: [] as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[],
}));

const { connectionRegistryInstances } = vi.hoisted(() => ({
    connectionRegistryInstances: [] as EventTarget[],
}));

const { appRouterInstances } = vi.hoisted(() => ({
    appRouterInstances: [] as EventTarget[],
}));

const allToolNames = [
    "gtkx_list_apps",
    "gtkx_get_widget_tree",
    "gtkx_query_widgets",
    "gtkx_get_widget_props",
    "gtkx_take_screenshot",
    "gtkx_click",
    "gtkx_type",
    "gtkx_fire_event",
    "gtkx_list_api",
    "gtkx_search_api",
    "gtkx_get_api_docs",
];

const allResourceNames = ["gtkx-api-reference", "gtkx-api-namespace", "gtkx-api-symbol"];

function makeAppRouter(overrides: Partial<AppRouterStub> = {}): AppRouterStub {
    return {
        getApps: vi.fn(() => []),
        hasConnectedApps: vi.fn(() => false),
        waitForApp: vi.fn(() => Promise.resolve({ applicationId: "app-a", pid: 1 })),
        sendToApp: vi.fn(() => Promise.resolve({} as never)),
        ...overrides,
    };
}

function makeConnectedAppRouter(apps: AppInfo[], sendToApp: AppRouterStub["sendToApp"]): AppRouterStub {
    return makeAppRouter({
        getApps: vi.fn(() => apps),
        hasConnectedApps: vi.fn(() => true),
        sendToApp,
    });
}

function resetMainMocks(): void {
    mcpServerInstances.length = 0;
    registerToolMock.mockClear();
    registerResourceMock.mockClear();
    mcpConnectMock.mockClear();
    mcpCloseMock.mockClear();
    socketStartMock.mockClear();
    socketStopMock.mockClear();
    socketServerInstances.length = 0;
    appRouterInstances.length = 0;
    stdioInstances.length = 0;
}

function registerTools(appRouter: AppRouterStub): RegisteredTool[] {
    resetMainMocks();
    createMcpServer({ version: "test" });
    const instance = appRouterInstances.at(-1);

    if (!instance) {
        throw new Error("AppRouter was not created");
    }

    Object.assign(instance, appRouter);

    return registerToolMock.mock.calls.map(([name, config, handler]) => ({
        name: name as string,
        config: config as RegisteredTool["config"],
        handler: handler as RegisteredTool["handler"],
    }));
}

function getTool(appRouter: AppRouterStub, name: string): RegisteredTool {
    const tool = registerTools(appRouter).find((t) => t.name === name);

    if (!tool) {
        throw new Error(`Tool not found: ${name}`);
    }

    return tool;
}

async function runListAppsWithFailingWait(thrown: unknown): Promise<{ type: "text"; text: string }> {
    const appRouter = makeAppRouter({
        hasConnectedApps: vi.fn(() => false),
        waitForApp: vi.fn(() => {
            throw thrown;
        }),
    });

    const result = await getTool(appRouter, "gtkx_list_apps").handler({ waitForApps: true } as never);
    expect(result.isError).toBe(true);

    return result.content[0] as { type: "text"; text: string };
}

async function runWidgetActionTool(
    tool: string,
    payload: Record<string, unknown>,
    response?: unknown,
): Promise<WidgetActionRun> {
    const sendToApp = vi.fn(() => Promise.resolve(response));
    const appRouter = makeAppRouter({ sendToApp: sendToApp as never });
    const result = await getTool(appRouter, tool).handler(payload as never);

    return { sendToApp, result };
}

function setupMainMocks(): MainSetup {
    resetMainMocks();

    return {
        errorSpy: vi.spyOn(process.stderr, "write").mockImplementation(() => true),
        exitSpy: vi.spyOn(process, "exit").mockImplementation(((): void => undefined) as never),
        prevSigInt: process.listeners("SIGINT"),
        prevSigTerm: process.listeners("SIGTERM"),
    };
}

function pruneListeners<T>(current: T[], previous: T[], remove: (listener: T) => void): void {
    for (const listener of current) {
        if (!previous.includes(listener)) {
            remove(listener);
        }
    }
}

function teardownMainMocks({ errorSpy, exitSpy, prevSigInt, prevSigTerm }: MainSetup): void {
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    pruneListeners(process.listeners("SIGINT"), prevSigInt, (listener) => process.removeListener("SIGINT", listener));

    pruneListeners(process.listeners("SIGTERM"), prevSigTerm, (listener) =>
        process.removeListener("SIGTERM", listener),
    );
}

function useMainSetup(): () => MainSetup {
    let setup: MainSetup;

    beforeEach(() => {
        setup = setupMainMocks();
    });

    afterEach(() => {
        teardownMainMocks(setup);
    });

    return () => setup;
}

function collectErrorMessages(setup: MainSetup): string[] {
    return setup.errorSpy.mock.calls.map((c: unknown[]) => String(c[0]));
}

function requireRegistry(): EventTarget {
    const registry = connectionRegistryInstances[0];

    if (!registry) {
        throw new Error("Registry not created");
    }

    return registry;
}

function dispatchSocketError(registry: EventTarget, message: string, code: string): void {
    const error = Object.assign(new Error(message), { code });
    registry.dispatchEvent(connectionErrorEvent(error));
}

function requireAppRouter(): EventTarget {
    const appRouter = appRouterInstances[0];

    if (!appRouter) {
        throw new Error("AppRouter not registered");
    }

    return appRouter;
}

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
    McpServer: class {
        connect = mcpConnectMock;
        close = mcpCloseMock;

        constructor(opts: { name: string; version: string }) {
            mcpServerInstances.push(opts);
        }

        registerTool(name: string, config: unknown, handler: unknown): void {
            registerToolMock(name, config, handler);
        }

        registerResource(name: string, uriOrTemplate: unknown, config: unknown, handler: unknown): void {
            registerResourceMock(name, uriOrTemplate, config, handler);
        }
    },
    ResourceTemplate: class {
        uriTemplate: unknown;
        callbacks: unknown;
        constructor(uriTemplate: unknown, callbacks: unknown) {
            this.uriTemplate = uriTemplate;
            this.callbacks = callbacks;
        }
    },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
    StdioServerTransport: class StdioServerTransport {
        sessionId: string | undefined;

        constructor() {
            stdioInstances.push(this);
        }
    },
}));

vi.mock("../src/socket-server.js", () => ({
    SocketServer: class SocketServer {
        start = socketStartMock;
        stop = socketStopMock;

        registry: unknown;
        path: string;

        constructor(registry: unknown, path: string) {
            this.registry = registry;
            this.path = path;
            socketServerInstances.push(this);
        }
    },
}));

vi.mock("../src/connection-registry.js", () => ({
    ConnectionRegistry: class extends EventTarget {
        constructor() {
            super();
            connectionRegistryInstances.push(this);
        }
    },
}));

vi.mock("../src/app-router.js", async () => {
    const actual = await vi.importActual<typeof import("../src/app-router.js")>("../src/app-router.js");

    return {
        ...actual,
        AppRouter: class extends EventTarget {
            constructor() {
                super();
                appRouterInstances.push(this);
            }
        },
    };
});

describe("buildTools — registration", () => {
    it("registers all expected tools in order", () => {
        const tools = registerTools(makeAppRouter());
        expect(tools.map((t) => t.name)).toEqual(allToolNames);
    });

    it("attaches a description and inputSchema to every tool", () => {
        const tools = registerTools(makeAppRouter());

        for (const tool of tools) {
            expect(tool.config.description.length).toBeGreaterThan(0);
            expect(tool.config.inputSchema).toBeDefined();
        }
    });

    it("registers the API reference resources", () => {
        registerTools(makeAppRouter());
        const registeredNames = registerResourceMock.mock.calls.map((call): unknown => call[0]);
        expect(registeredNames).toEqual(allResourceNames);
    });
});

describe("buildTools — gtkx_list_apps success", () => {
    it("returns connected apps with their windows", async () => {
        const apps: AppInfo[] = [{ applicationId: "app-a", pid: 1 }];

        const sendToApp = vi.fn(() =>
            Promise.resolve({
                windows: [{ id: "w1", title: "Main" }],
            }),
        );

        const appRouter = makeConnectedAppRouter(apps, sendToApp as never);
        const result = await getTool(appRouter, "gtkx_list_apps").handler({} as never);
        expect(sendToApp).toHaveBeenCalledWith("app-a", "app.getWindows", {});
        expect(result.content[0]).toMatchObject({ type: "text" });
        const text = result.content[0] as { type: "text"; text: string };

        expect(JSON.parse(text.text)).toEqual([
            { applicationId: "app-a", pid: 1, windows: [{ id: "w1", title: "Main" }] },
        ]);
    });

    it("falls back to the original app info when getWindows fails", async () => {
        const apps: AppInfo[] = [{ applicationId: "app-a", pid: 1 }];
        const appRouter = makeConnectedAppRouter(apps, vi.fn(() => Promise.reject(new Error("boom"))));
        const result = await getTool(appRouter, "gtkx_list_apps").handler({} as never);
        const text = result.content[0] as { type: "text"; text: string };
        expect(JSON.parse(text.text)).toEqual(apps);
    });
});

describe("buildTools — gtkx_list_apps waiting", () => {
    it("waits for an app when waitForApps is true and none are connected", async () => {
        const waitForApp = vi.fn(() => Promise.resolve({ applicationId: "app-a", pid: 1 }));

        const appRouter = makeAppRouter({
            hasConnectedApps: vi.fn(() => false),
            waitForApp: waitForApp,
        });

        await getTool(appRouter, "gtkx_list_apps").handler({ waitForApps: true, timeout: 5000 } as never);
        expect(waitForApp).toHaveBeenCalledWith(5000);
    });

    it("returns an error result when waitForApp times out", async () => {
        const text = await runListAppsWithFailingWait(new Error("Timeout waiting for app registration"));
        expect(text.text).toContain("Timeout");
    });

    it("stringifies a non-Error thrown by waitForApp into the error result", async () => {
        const text = await runListAppsWithFailingWait("not an Error");
        expect(text.text).toBe("not an Error");
    });

    it("does not call waitForApp when apps are already connected", async () => {
        const waitForApp = vi.fn();

        const appRouter = makeAppRouter({
            hasConnectedApps: vi.fn(() => true),
            waitForApp: waitForApp as never,
        });

        await getTool(appRouter, "gtkx_list_apps").handler({ waitForApps: true } as never);
        expect(waitForApp).not.toHaveBeenCalled();
    });
});

describe("buildTools — gtkx_get_widget_tree", () => {
    it("forwards applicationId and returns the tree string", async () => {
        const sendToApp = vi.fn(() => Promise.resolve({ tree: "TREE" }));
        const appRouter = makeAppRouter({ sendToApp: sendToApp as never });
        const result = await getTool(appRouter, "gtkx_get_widget_tree").handler({ applicationId: "app-a" } as never);
        expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.getTree", {});
        expect(result.content[0]).toEqual({ type: "text", text: "TREE" });
    });
});

describe("buildTools — gtkx_query_widgets", () => {
    it("forwards query parameters and returns serialized result", async () => {
        const sendToApp = vi.fn(() => Promise.resolve({ widgets: [{ id: "w1" }] }));
        const appRouter = makeAppRouter({ sendToApp: sendToApp as never });

        const result = await getTool(appRouter, "gtkx_query_widgets").handler({
            applicationId: "app-a",
            by: "role",
            value: "button",
            options: { exact: true },
        } as never);

        expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.query", {
            by: "role",
            value: "button",
            options: { exact: true },
        });

        const text = result.content[0] as { type: "text"; text: string };
        expect(JSON.parse(text.text)).toEqual({ widgets: [{ id: "w1" }] });
    });
});

describe("buildTools — gtkx_get_widget_props", () => {
    it("returns props serialized as JSON", async () => {
        const sendToApp = vi.fn(() => Promise.resolve({ label: "Click me" }));
        const appRouter = makeAppRouter({ sendToApp: sendToApp as never });

        const result = await getTool(appRouter, "gtkx_get_widget_props").handler({
            applicationId: "app-a",
            widgetId: "w1",
        } as never);

        expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.getProps", { widgetId: "w1" });
        const text = result.content[0] as { type: "text"; text: string };
        expect(JSON.parse(text.text)).toEqual({ label: "Click me" });
    });

    it("forwards the requested property names to the app", async () => {
        const properties = { collapsed: { type: "gboolean", value: true } };
        const sendToApp = vi.fn(() => Promise.resolve({ properties }));
        const appRouter = makeAppRouter({ sendToApp: sendToApp as never });

        const result = await getTool(appRouter, "gtkx_get_widget_props").handler({
            widgetId: "w1",
            properties: ["collapsed"],
        } as never);

        expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.getProps", {
            widgetId: "w1",
            properties: ["collapsed"],
        });

        const text = result.content[0] as { type: "text"; text: string };
        expect(JSON.parse(text.text)).toEqual({ properties });
    });
});

describe("buildTools — gtkx_click", () => {
    it("sends a widget.click and returns a confirmation message", async () => {
        const payload = { widgetId: "w1" };
        const { sendToApp, result } = await runWidgetActionTool("gtkx_click", payload);
        expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.click", payload);
        expect(result.content[0]).toEqual({ type: "text", text: "Clicked" });
    });
});

describe("buildTools — gtkx_type", () => {
    it("forwards text and clear flag", async () => {
        const payload = { widgetId: "w1", text: "hello", clear: true };
        const { sendToApp, result } = await runWidgetActionTool("gtkx_type", payload);
        expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.type", payload);
        expect(result.content[0]).toEqual({ type: "text", text: "Typed text" });
    });
});

describe("buildTools — gtkx_fire_event", () => {
    it("forwards signal name and args", async () => {
        const payload = { widgetId: "w1", signal: "clicked", args: ["arg1"] };
        const response = { signal: "clicked", isRealized: true, isMapped: true, isSensitive: true, note: "emitted" };
        const { sendToApp, result } = await runWidgetActionTool("gtkx_fire_event", payload, response);
        expect(sendToApp).toHaveBeenCalledWith(undefined, "widget.fireEvent", payload);
        expect(result.content[0]).toEqual({ type: "text", text: JSON.stringify(response, null, 2) });
    });

    it("reports the widget state back to the caller instead of a fixed string", async () => {
        const response = { signal: "activate", isRealized: false, isMapped: false, isSensitive: true, note: "n/a" };
        const payload = { widgetId: "w1", signal: "activate" };
        const { result } = await runWidgetActionTool("gtkx_fire_event", payload, response);
        const text = (result.content[0] as { text: string }).text;
        expect(text).toContain('"isRealized": false');
        expect(text).toContain('"isMapped": false');
    });
});

describe("buildTools — gtkx_take_screenshot", () => {
    it("returns image content from the response", async () => {
        const sendToApp = vi.fn(() => Promise.resolve({ data: "BASE64", mimeType: "image/png" }));
        const appRouter = makeAppRouter({ sendToApp: sendToApp as never });

        const result = await getTool(appRouter, "gtkx_take_screenshot").handler({
            applicationId: "app-a",
            windowId: "w-main",
        } as never);

        expect(sendToApp).toHaveBeenCalledWith("app-a", "widget.screenshot", { windowId: "w-main" });
        expect(result.content[0]).toEqual({ type: "image", data: "BASE64", mimeType: "image/png" });
    });
});

describe("main — startup", () => {
    useMainSetup();

    it("starts the socket server, registers all tools, and connects the MCP server", async () => {
        await main();
        expect(socketStartMock).toHaveBeenCalledOnce();
        expect(mcpServerInstances).toHaveLength(1);
        expect(mcpServerInstances[0]?.name).toBe("gtkx-mcp");
        expect(registerToolMock).toHaveBeenCalledTimes(allToolNames.length);
        expect(mcpConnectMock).toHaveBeenCalledOnce();
        expect(stdioInstances).toHaveLength(1);
    });
});

describe("main — error logging", () => {
    const getSetup = useMainSetup();

    it("logs broken-pipe-style socket errors only when the code is not EPIPE/ECONNRESET", async () => {
        await main();
        const registry = requireRegistry();
        dispatchSocketError(registry, "pipe gone", "EPIPE");
        dispatchSocketError(registry, "conn gone", "ECONNRESET");
        dispatchSocketError(registry, "real boom", "EACCES");
        const messages = collectErrorMessages(getSetup());
        expect(messages.filter((m: string) => m.includes("real boom"))).toHaveLength(1);
        expect(messages.some((m: string) => m.includes("pipe gone"))).toBe(false);
        expect(messages.some((m: string) => m.includes("conn gone"))).toBe(false);
    });

    it("logs an entry when an app registers and unregisters", async () => {
        await main();
        const appRouter = requireAppRouter();
        appRouter.dispatchEvent(appRegisteredEvent({ applicationId: "app-a", pid: 42 }));
        appRouter.dispatchEvent(appUnregisteredEvent("app-a"));
        const messages = collectErrorMessages(getSetup());
        expect(messages.some((m: string) => m.includes("app registered: app-a (PID: 42)"))).toBe(true);
        expect(messages.some((m: string) => m.includes("app unregistered: app-a"))).toBe(true);
    });
});

describe("main — shutdown", () => {
    const getSetup = useMainSetup();

    it("shuts down on SIGINT, cleaning up resources exactly once", async () => {
        await main();
        process.emit("SIGINT", "SIGINT");
        await new Promise((resolve) => setImmediate(resolve));
        expect(socketStopMock).toHaveBeenCalledOnce();
        expect(mcpCloseMock).toHaveBeenCalledOnce();
        expect(getSetup().exitSpy).toHaveBeenCalledWith(0);
        process.emit("SIGTERM", "SIGTERM");
        await new Promise((resolve) => setImmediate(resolve));
        expect(socketStopMock).toHaveBeenCalledOnce();
    });
});

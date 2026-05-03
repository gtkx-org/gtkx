import { describe, expect, it, vi } from "vitest";
import { buildTools } from "../src/cli.js";
import type { ConnectionManager } from "../src/connection-manager.js";
import type { AppInfo } from "../src/protocol/types.js";

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
            expect(JSON.parse(text.text)).toEqual([
                { appId: "app-a", pid: 1, windows: [{ id: "w1", title: "Main" }] },
            ]);
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

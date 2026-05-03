#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConnectionManager } from "./connection-manager.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/types.js";
import { SocketServer } from "./socket-server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const APP_ID_DESCRIPTION = "App ID to query. If not specified, uses the first connected app.";
const WIDGET_ID_DESCRIPTION = "Widget ID";

const appIdField = z.string().optional().describe(APP_ID_DESCRIPTION);
const widgetIdField = z.string().describe(WIDGET_ID_DESCRIPTION);

const appIdShape = { appId: appIdField } as const;
const widgetIdShape = { ...appIdShape, widgetId: widgetIdField } as const;

const listAppsShape = {
    waitForApps: z
        .boolean()
        .optional()
        .describe(
            "If true, wait for at least one app to register before returning. Useful when app is still starting.",
        ),
    timeout: z.number().optional().describe("Timeout in milliseconds when waitForApps is true (default: 10000)"),
} as const;

const queryWidgetsShape = {
    ...appIdShape,
    by: z.enum(["role", "text", "name", "labelText"]).describe("Query type"),
    value: z.union([z.string(), z.number()]).describe("Value to search for"),
    options: z
        .object({
            name: z.string().optional(),
            exact: z.boolean().optional(),
            timeout: z.number().optional(),
        })
        .optional()
        .describe("Additional query options"),
} as const;

const typeShape = {
    ...widgetIdShape,
    text: z.string().describe("Text to type"),
    clear: z.boolean().optional().describe("Clear existing text before typing"),
} as const;

const fireEventShape = {
    ...widgetIdShape,
    signal: z.string().describe("GTK signal name to emit"),
    args: z.array(z.unknown()).optional().describe("Arguments to pass to the signal"),
} as const;

const screenshotShape = {
    ...appIdShape,
    windowId: z.string().optional().describe("Window ID to capture. If not specified, captures the first window."),
} as const;

const textContent = (text: string) => ({ content: [{ type: "text" as const, text }] });

const textError = (text: string) => ({
    content: [{ type: "text" as const, text }],
    isError: true,
});

type AppQueryClient = Pick<
    ConnectionManager,
    "getApps" | "hasConnectedApps" | "waitForApp" | "sendToApp"
>;

type ToolHandlerResult = {
    content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
    isError?: boolean;
};

type ToolDefinition<Args> = {
    name: string;
    config: { description: string; inputSchema: unknown };
    handler: (args: Args) => Promise<ToolHandlerResult>;
};

/**
 * Builds the GTKX MCP tool definitions, ready to be registered on a server.
 *
 * Exposed so tests can drive each tool handler against a fake
 * {@link ConnectionManager} without spinning up a real socket server.
 *
 * @param connectionManager - Connection manager that proxies tool requests to
 *   the connected GTKX application.
 * @returns Array of tool definitions in registration order.
 */
export function buildTools(connectionManager: AppQueryClient): Array<ToolDefinition<never>> {
    const tools: Array<ToolDefinition<never>> = [
        {
            name: "gtkx_list_apps",
            config: {
                description: "List all connected GTKX applications",
                inputSchema: listAppsShape,
            },
            handler: (async ({ waitForApps, timeout }: { waitForApps?: boolean; timeout?: number }) => {
                if (waitForApps && !connectionManager.hasConnectedApps()) {
                    try {
                        await connectionManager.waitForApp(timeout);
                    } catch (error) {
                        return textError(error instanceof Error ? error.message : "Timeout waiting for app");
                    }
                }

                const apps = connectionManager.getApps();
                const appsWithWindows = await Promise.all(
                    apps.map(async (app) => {
                        try {
                            const result = await connectionManager.sendToApp<{
                                windows: Array<{ id: string; title: string | null }>;
                            }>(app.appId, "app.getWindows", {});
                            return { ...app, windows: result.windows };
                        } catch {
                            return app;
                        }
                    }),
                );
                return textContent(JSON.stringify(appsWithWindows, null, 2));
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_get_widget_tree",
            config: {
                description:
                    "Get the widget hierarchy for a connected GTKX app. Returns a tree of all widgets with their IDs, types, roles, and properties.",
                inputSchema: appIdShape,
            },
            handler: (async ({ appId }: { appId?: string }) => {
                const result = await connectionManager.sendToApp<{ tree: string }>(appId, "widget.getTree", {});
                return textContent(result.tree);
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_query_widgets",
            config: {
                description:
                    "Find widgets by role, text, name, or label. Returns matching widgets with their IDs and properties.",
                inputSchema: queryWidgetsShape,
            },
            handler: (async ({
                appId,
                by,
                value,
                options,
            }: {
                appId?: string;
                by: "role" | "text" | "name" | "labelText";
                value: string | number;
                options?: { name?: string; exact?: boolean; timeout?: number };
            }) => {
                const result = await connectionManager.sendToApp(appId, "widget.query", {
                    queryType: by,
                    value,
                    options,
                });
                return textContent(JSON.stringify(result, null, 2));
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_get_widget_props",
            config: {
                description: "Get all properties of a specific widget by its ID",
                inputSchema: widgetIdShape,
            },
            handler: (async ({ appId, widgetId }: { appId?: string; widgetId: string }) => {
                const result = await connectionManager.sendToApp(appId, "widget.getProps", { widgetId });
                return textContent(JSON.stringify(result, null, 2));
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_click",
            config: {
                description: "Click a widget. Works with buttons, checkboxes, and other interactive widgets.",
                inputSchema: widgetIdShape,
            },
            handler: (async ({ appId, widgetId }: { appId?: string; widgetId: string }) => {
                await connectionManager.sendToApp(appId, "widget.click", { widgetId });
                return textContent("Click successful");
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_type",
            config: {
                description: "Type text into an editable widget like Entry or TextView",
                inputSchema: typeShape,
            },
            handler: (async ({
                appId,
                widgetId,
                text,
                clear,
            }: {
                appId?: string;
                widgetId: string;
                text: string;
                clear?: boolean;
            }) => {
                await connectionManager.sendToApp(appId, "widget.type", { widgetId, text, clear });
                return textContent("Type successful");
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_fire_event",
            config: {
                description: "Emit a GTK signal on a widget. Use this for custom interactions.",
                inputSchema: fireEventShape,
            },
            handler: (async ({
                appId,
                widgetId,
                signal,
                args,
            }: {
                appId?: string;
                widgetId: string;
                signal: string;
                args?: unknown[];
            }) => {
                await connectionManager.sendToApp(appId, "widget.fireEvent", { widgetId, signal, args });
                return textContent("Event fired successfully");
            }) as ToolDefinition<never>["handler"],
        },
        {
            name: "gtkx_take_screenshot",
            config: {
                description: "Capture a screenshot of a window. Returns base64-encoded PNG image data.",
                inputSchema: screenshotShape,
            },
            handler: (async ({ appId, windowId }: { appId?: string; windowId?: string }) => {
                const result = await connectionManager.sendToApp<{ data: string; mimeType: string }>(
                    appId,
                    "widget.screenshot",
                    { windowId },
                );
                return {
                    content: [
                        {
                            type: "image" as const,
                            data: result.data,
                            mimeType: result.mimeType,
                        },
                    ],
                };
            }) as ToolDefinition<never>["handler"],
        },
    ];

    return tools;
}

async function main() {
    const socketServer = new SocketServer(DEFAULT_SOCKET_PATH);
    const connectionManager = new ConnectionManager(socketServer);

    socketServer.on("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPIPE" && code !== "ECONNRESET") {
            console.error("[gtkx] Socket error:", error.message);
        }
    });

    await socketServer.start();
    console.error(`[gtkx] Socket server listening on ${DEFAULT_SOCKET_PATH}`);

    connectionManager.on("appRegistered", (appInfo) => {
        console.error(`[gtkx] App registered: ${appInfo.appId} (PID: ${appInfo.pid})`);
    });

    connectionManager.on("appUnregistered", (appId) => {
        console.error(`[gtkx] App unregistered: ${appId}`);
    });

    const mcpServer = new McpServer({
        name: "gtkx-mcp",
        version,
    });

    for (const tool of buildTools(connectionManager)) {
        mcpServer.registerTool(tool.name, tool.config as never, tool.handler as never);
    }

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    let isShuttingDown = false;
    const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        try {
            connectionManager.cleanup();
            await socketServer.stop();
            await mcpServer.close();
        } finally {
            process.exit(0);
        }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error("[gtkx] Fatal error:", error);
        process.exit(1);
    }
}

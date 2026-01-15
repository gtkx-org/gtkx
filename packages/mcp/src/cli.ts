#!/usr/bin/env node

import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnectionManager } from "./connection-manager.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/types.js";
import { SocketServer } from "./socket-server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const AppIdSchema = z.object({
    appId: z.string().optional().describe("App ID to query. If not specified, uses the first connected app."),
});

const ListAppsInputSchema = z.object({
    waitForApps: z
        .boolean()
        .optional()
        .describe(
            "If true, wait for at least one app to register before returning. Useful when app is still starting.",
        ),
    timeout: z.number().optional().describe("Timeout in milliseconds when waitForApps is true (default: 10000)"),
});

const GetWidgetTreeInputSchema = AppIdSchema;

const QueryWidgetsInputSchema = AppIdSchema.extend({
    by: z.enum(["role", "text", "testId", "labelText"]).describe("Query type"),
    value: z.union([z.string(), z.number()]).describe("Value to search for"),
    options: z
        .object({
            name: z.string().optional(),
            exact: z.boolean().optional(),
            timeout: z.number().optional(),
        })
        .optional()
        .describe("Additional query options"),
});

const WidgetIdSchema = AppIdSchema.extend({
    widgetId: z.string().describe("Widget ID"),
});

const GetWidgetPropsInputSchema = WidgetIdSchema;

const ClickInputSchema = WidgetIdSchema;

const TypeInputSchema = WidgetIdSchema.extend({
    text: z.string().describe("Text to type"),
    clear: z.boolean().optional().describe("Clear existing text before typing"),
});

const FireEventInputSchema = WidgetIdSchema.extend({
    signal: z.string().describe("GTK signal name to emit"),
    args: z.array(z.unknown()).optional().describe("Arguments to pass to the signal"),
});

const TakeScreenshotInputSchema = AppIdSchema.extend({
    windowId: z.string().optional().describe("Window ID to capture. If not specified, captures the first window."),
});

const tools = [
    {
        name: "gtkx_list_apps",
        description: "List all connected GTKX applications",
        inputSchema: {
            type: "object" as const,
            properties: {
                waitForApps: {
                    type: "boolean",
                    description:
                        "If true, wait for at least one app to register before returning. Useful when app is still starting.",
                },
                timeout: {
                    type: "number",
                    description: "Timeout in milliseconds when waitForApps is true (default: 10000)",
                },
            },
            required: [],
        },
    },
    {
        name: "gtkx_get_widget_tree",
        description:
            "Get the widget hierarchy for a connected GTKX app. Returns a tree of all widgets with their IDs, types, roles, and properties.",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
            },
            required: [],
        },
    },
    {
        name: "gtkx_query_widgets",
        description:
            "Find widgets by role, text, testId, or label. Returns matching widgets with their IDs and properties.",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                by: {
                    type: "string",
                    enum: ["role", "text", "testId", "labelText"],
                    description: "Query type",
                },
                value: {
                    oneOf: [{ type: "string" }, { type: "number" }],
                    description: "Value to search for",
                },
                options: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        exact: { type: "boolean" },
                        timeout: { type: "number" },
                    },
                    description: "Additional query options",
                },
            },
            required: ["by", "value"],
        },
    },
    {
        name: "gtkx_get_widget_props",
        description: "Get all properties of a specific widget by its ID",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                widgetId: {
                    type: "string",
                    description: "Widget ID to get properties for",
                },
            },
            required: ["widgetId"],
        },
    },
    {
        name: "gtkx_click",
        description: "Click a widget. Works with buttons, checkboxes, and other interactive widgets.",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                widgetId: {
                    type: "string",
                    description: "Widget ID to click",
                },
            },
            required: ["widgetId"],
        },
    },
    {
        name: "gtkx_type",
        description: "Type text into an editable widget like Entry or TextView",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                widgetId: {
                    type: "string",
                    description: "Widget ID to type into",
                },
                text: {
                    type: "string",
                    description: "Text to type",
                },
                clear: {
                    type: "boolean",
                    description: "Clear existing text before typing",
                },
            },
            required: ["widgetId", "text"],
        },
    },
    {
        name: "gtkx_fire_event",
        description: "Emit a GTK signal on a widget. Use this for custom interactions.",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                widgetId: {
                    type: "string",
                    description: "Widget ID to emit event on",
                },
                signal: {
                    type: "string",
                    description: "GTK signal name to emit",
                },
                args: {
                    type: "array",
                    items: {},
                    description: "Arguments to pass to the signal",
                },
            },
            required: ["widgetId", "signal"],
        },
    },
    {
        name: "gtkx_take_screenshot",
        description: "Capture a screenshot of a window. Returns base64-encoded PNG image data.",
        inputSchema: {
            type: "object" as const,
            properties: {
                appId: {
                    type: "string",
                    description: "App ID to query. If not specified, uses the first connected app.",
                },
                windowId: {
                    type: "string",
                    description: "Window ID to capture. If not specified, captures the first window.",
                },
            },
            required: [],
        },
    },
];

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

    const server = new Server(
        {
            name: "gtkx-mcp",
            version,
        },
        {
            capabilities: {
                tools: {},
            },
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            switch (name) {
                case "gtkx_list_apps": {
                    const input = ListAppsInputSchema.parse(args);

                    if (input.waitForApps && !connectionManager.hasConnectedApps()) {
                        try {
                            await connectionManager.waitForApp(input.timeout);
                        } catch (error) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: error instanceof Error ? error.message : "Timeout waiting for app",
                                    },
                                ],
                                isError: true,
                            };
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
                    return {
                        content: [{ type: "text", text: JSON.stringify(appsWithWindows, null, 2) }],
                    };
                }

                case "gtkx_get_widget_tree": {
                    const input = GetWidgetTreeInputSchema.parse(args);
                    const result = await connectionManager.sendToApp<{ tree: string }>(
                        input.appId,
                        "widget.getTree",
                        {},
                    );
                    return {
                        content: [{ type: "text", text: result.tree }],
                    };
                }

                case "gtkx_query_widgets": {
                    const input = QueryWidgetsInputSchema.parse(args);
                    const result = await connectionManager.sendToApp(input.appId, "widget.query", {
                        queryType: input.by,
                        value: input.value,
                        options: input.options,
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "gtkx_get_widget_props": {
                    const input = GetWidgetPropsInputSchema.parse(args);
                    const result = await connectionManager.sendToApp(input.appId, "widget.getProps", {
                        widgetId: input.widgetId,
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "gtkx_click": {
                    const input = ClickInputSchema.parse(args);
                    await connectionManager.sendToApp(input.appId, "widget.click", {
                        widgetId: input.widgetId,
                    });
                    return {
                        content: [{ type: "text", text: "Click successful" }],
                    };
                }

                case "gtkx_type": {
                    const input = TypeInputSchema.parse(args);
                    await connectionManager.sendToApp(input.appId, "widget.type", {
                        widgetId: input.widgetId,
                        text: input.text,
                        clear: input.clear,
                    });
                    return {
                        content: [{ type: "text", text: "Type successful" }],
                    };
                }

                case "gtkx_fire_event": {
                    const input = FireEventInputSchema.parse(args);
                    await connectionManager.sendToApp(input.appId, "widget.fireEvent", {
                        widgetId: input.widgetId,
                        signal: input.signal,
                        args: input.args,
                    });
                    return {
                        content: [{ type: "text", text: "Event fired successfully" }],
                    };
                }

                case "gtkx_take_screenshot": {
                    const input = TakeScreenshotInputSchema.parse(args);
                    const result = await connectionManager.sendToApp<{ data: string; mimeType: string }>(
                        input.appId,
                        "widget.screenshot",
                        {
                            windowId: input.windowId,
                        },
                    );
                    return {
                        content: [
                            {
                                type: "image",
                                data: result.data,
                                mimeType: result.mimeType,
                            },
                        ],
                    };
                }

                default:
                    return {
                        content: [{ type: "text", text: `Unknown tool: ${name}` }],
                        isError: true,
                    };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: message }],
                isError: true,
            };
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    let isShuttingDown = false;
    const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        try {
            connectionManager.cleanup();
            await socketServer.stop();
            await server.close();
        } finally {
            process.exit(0);
        }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((error) => {
    console.error("[gtkx] Fatal error:", error);
    process.exit(1);
});

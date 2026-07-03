import { createRequire } from "node:module";
import { createLogger, installGracefulShutdown, type Logger } from "@gtkx/utils";
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AppRouter } from "./app-router.js";
import { ConnectionRegistry } from "./connection-registry.js";
import { ProtocolError } from "./protocol/errors.js";
import {
    DEFAULT_SOCKET_PATH,
    fireEventParams,
    queryParams,
    screenshotParams,
    typeParams,
    widgetIdParams,
} from "./protocol/types.js";
import { SocketServer } from "./socket-server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export const log: Logger = createLogger("mcp");

const APPLICATION_ID_DESCRIPTION = "Application ID to query. If not specified, uses the first connected app.";
const WIDGET_ID_DESCRIPTION =
    "Widget ID obtained from `gtkx_get_widget_tree` or `gtkx_query_widgets`. IDs are only valid against a recent tree/query for the same app.";

const applicationIdShape = { applicationId: z.string().optional().describe(APPLICATION_ID_DESCRIPTION) };
const widgetIdShape = {
    ...applicationIdShape,
    widgetId: widgetIdParams.shape.widgetId.describe(WIDGET_ID_DESCRIPTION),
};

const listAppsShape = {
    waitForApps: z
        .boolean()
        .optional()
        .describe(
            "If true, wait for at least one app to register before returning. Useful when app is still starting.",
        ),
    timeout: z.number().optional().describe("Timeout in milliseconds when waitForApps is true (default: 10000)"),
};

const queryWidgetsShape = {
    ...applicationIdShape,
    by: queryParams.shape.by.describe("Query type"),
    value: queryParams.shape.value.describe("Value to search for"),
    options: queryParams.shape.options.describe("Additional query options"),
};

const typeShape = {
    ...widgetIdShape,
    text: typeParams.shape.text.describe("Text to type"),
    clear: typeParams.shape.clear.describe("Clear existing text before typing"),
};

const fireEventShape = {
    ...widgetIdShape,
    signal: fireEventParams.shape.signal.describe("GTK signal name to emit"),
    args: fireEventParams.shape.args.describe("Arguments to pass to the signal"),
};

const screenshotShape = {
    ...applicationIdShape,
    windowId: screenshotParams.shape.windowId.describe(
        "Window ID to capture. If not specified, captures the first window.",
    ),
};

const textContent = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });

const textError = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
});

const imageContent = (data: string, mimeType: string): CallToolResult => ({
    content: [{ type: "image", data, mimeType }],
});

type ToolArgs<Shape extends Record<string, z.ZodType>> = { [K in keyof Shape]: z.output<Shape[K]> };

type ToolKind = "readOnly" | "action";

type Tool<Shape extends Record<string, z.ZodType> = Record<string, z.ZodType>> = {
    name: string;
    title: string;
    kind: ToolKind;
    description: string;
    inputSchema: Shape;
    handler: (args: ToolArgs<Shape>) => Promise<CallToolResult>;
};

const hasStringHint = (data: unknown): data is { hint: string } =>
    typeof data === "object" && data !== null && "hint" in data && typeof data.hint === "string";

const runTool = async (
    handler: (args: ToolArgs<Record<string, z.ZodType>>) => Promise<CallToolResult>,
    args: ToolArgs<Record<string, z.ZodType>>,
): Promise<CallToolResult> => {
    try {
        return await handler(args);
    } catch (error) {
        if (error instanceof ProtocolError) {
            return textError(hasStringHint(error.data) ? `${error.message}\n${error.data.hint}` : error.message);
        }
        return textError(error instanceof Error ? error.message : String(error));
    }
};

const defineTool = <Shape extends Record<string, z.ZodType>>(tool: Tool<Shape>): Tool => tool as Tool;

const registerTool = (server: McpServer, tool: Tool): void => {
    const callback = ((args: ToolArgs<Record<string, z.ZodType>>, _extra: unknown) =>
        runTool(tool.handler, args)) as ToolCallback<Record<string, z.ZodType>>;
    server.registerTool(
        tool.name,
        {
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
                title: tool.title,
                readOnlyHint: tool.kind === "readOnly",
                destructiveHint: tool.kind === "action",
                openWorldHint: true,
            },
        },
        callback,
    );
};

const listAppsTool = (appRouter: AppRouter): Tool =>
    defineTool({
        name: "gtkx_list_apps",
        title: "List apps",
        kind: "readOnly",
        description: "List all connected GTKX applications and their open windows.",
        inputSchema: listAppsShape,
        handler: async ({ waitForApps, timeout }) => {
            if (waitForApps && !appRouter.hasConnectedApps()) {
                await appRouter.waitForApp(timeout);
            }

            const apps = appRouter.getApps();
            const appsWithWindows = await Promise.all(
                apps.map(async (app) => {
                    try {
                        const result = await appRouter.sendToApp<{
                            windows: Array<{ id: string; title: string | null }>;
                        }>(app.applicationId, "app.getWindows", {});
                        return { ...app, windows: result.windows };
                    } catch {
                        return app;
                    }
                }),
            );
            return textContent(JSON.stringify(appsWithWindows, null, 2));
        },
    });

const screenshotTool = (appRouter: AppRouter): Tool =>
    defineTool({
        name: "gtkx_take_screenshot",
        title: "Take screenshot",
        kind: "readOnly",
        description:
            "Capture a screenshot of a window. Returns base64-encoded PNG image data. You can't target widgets from a screenshot; use `gtkx_get_widget_tree` to find widget IDs for interaction.",
        inputSchema: screenshotShape,
        handler: async ({ applicationId, ...params }) => {
            const result = await appRouter.sendToApp<{ data: string; mimeType: string }>(
                applicationId,
                "widget.screenshot",
                params,
            );
            return imageContent(result.data, result.mimeType);
        },
    });

function buildInspectionTools(appRouter: AppRouter): Tool[] {
    return [
        listAppsTool(appRouter),
        defineTool({
            name: "gtkx_get_widget_tree",
            title: "Widget tree",
            kind: "readOnly",
            description:
                "Get the widget hierarchy for a connected GTKX app. Returns a tree of all widgets with their IDs, types, roles, and properties.",
            inputSchema: applicationIdShape,
            handler: async ({ applicationId }) => {
                const result = await appRouter.sendToApp<{ tree: string }>(applicationId, "widget.getTree", {});
                return textContent(result.tree);
            },
        }),
        defineTool({
            name: "gtkx_query_widgets",
            title: "Query widgets",
            kind: "readOnly",
            description:
                "Find widgets by role, text, name, or label. Returns matching widgets with their IDs and properties.",
            inputSchema: queryWidgetsShape,
            handler: async ({ applicationId, ...params }) => {
                const result = await appRouter.sendToApp(applicationId, "widget.query", params);
                return textContent(JSON.stringify(result, null, 2));
            },
        }),
        defineTool({
            name: "gtkx_get_widget_props",
            title: "Get widget properties",
            kind: "readOnly",
            description: "Get all properties of a specific widget by its ID",
            inputSchema: widgetIdShape,
            handler: async ({ applicationId, ...params }) => {
                const result = await appRouter.sendToApp(applicationId, "widget.getProps", params);
                return textContent(JSON.stringify(result, null, 2));
            },
        }),
        screenshotTool(appRouter),
    ];
}

function buildInteractionTools(appRouter: AppRouter): Tool[] {
    return [
        defineTool({
            name: "gtkx_click",
            title: "Click widget",
            kind: "action",
            description: "Click a widget. Works with buttons, checkboxes, and other interactive widgets.",
            inputSchema: widgetIdShape,
            handler: async ({ applicationId, ...params }) => {
                await appRouter.sendToApp(applicationId, "widget.click", params);
                return textContent("Clicked");
            },
        }),
        defineTool({
            name: "gtkx_type",
            title: "Type text",
            kind: "action",
            description: "Type text into an editable widget like Entry or TextView",
            inputSchema: typeShape,
            handler: async ({ applicationId, ...params }) => {
                await appRouter.sendToApp(applicationId, "widget.type", params);
                return textContent("Typed text");
            },
        }),
        defineTool({
            name: "gtkx_fire_event",
            title: "Fire event",
            kind: "action",
            description: "Emit a GTK signal on a widget. Use this for custom interactions.",
            inputSchema: fireEventShape,
            handler: async ({ applicationId, ...params }) => {
                await appRouter.sendToApp(applicationId, "widget.fireEvent", params);
                return textContent("Fired event");
            },
        }),
    ];
}

function buildTools(appRouter: AppRouter): Tool[] {
    return [...buildInspectionTools(appRouter), ...buildInteractionTools(appRouter)];
}

type CreateMcpServerOptions = {
    socketPath?: string;
    version: string;
};

type McpServerHandle = {
    start(): Promise<void>;
    stop(): Promise<void>;
};

export const createMcpServer = (options: CreateMcpServerOptions): McpServerHandle => {
    const socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;

    const registry = new ConnectionRegistry();
    const socketServer = new SocketServer(registry, socketPath);
    const appRouter = new AppRouter(registry);

    registry.on("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPIPE" && code !== "ECONNRESET") {
            log.error(`socket error: ${error.message}`);
        }
    });

    appRouter.on("appRegistered", (appInfo) => {
        log.info(`app registered: ${appInfo.applicationId} (PID: ${appInfo.pid})`);
    });

    appRouter.on("appUnregistered", (applicationId) => {
        log.info(`app unregistered: ${applicationId}`);
    });

    const mcpServer = new McpServer({ name: "gtkx-mcp", version: options.version });

    for (const tool of buildTools(appRouter)) {
        registerTool(mcpServer, tool);
    }

    let stopped = false;

    return {
        async start() {
            await socketServer.start();
            log.info(`socket server listening on ${socketPath}`);
            const transport = new StdioServerTransport();
            process.stdin.on("end", () => void this.stop());
            process.stdin.on("close", () => void this.stop());
            await mcpServer.connect(transport);
        },
        async stop() {
            if (stopped) return;
            stopped = true;
            await socketServer.stop();
            await mcpServer.close();
        },
    };
};

export async function main(): Promise<void> {
    const server = createMcpServer({ version });
    installGracefulShutdown({
        onSignal: () => server.stop(),
    });
    await server.start();
}

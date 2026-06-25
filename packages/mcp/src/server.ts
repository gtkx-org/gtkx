import { createRequire } from "node:module";
import { installGracefulShutdown } from "@gtkx/utils";
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AppRouter } from "./app-router.js";
import { ConnectionRegistry } from "./connection-registry.js";
import { IpcError } from "./protocol/errors.js";
import { DEFAULT_SOCKET_PATH, queryOptionsSchema, type ServerInitiatedMethod } from "./protocol/types.js";
import { SocketServer } from "./socket-server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const APPLICATION_ID_DESCRIPTION = "Application ID to query. If not specified, uses the first connected app.";
const WIDGET_ID_DESCRIPTION =
    "Widget ID obtained from `gtkx_get_widget_tree` or `gtkx_query_widgets`. IDs are only valid against a recent tree/query for the same app.";

const applicationIdField = z.string().optional().describe(APPLICATION_ID_DESCRIPTION);
const widgetIdField = z.string().describe(WIDGET_ID_DESCRIPTION);

const applicationIdShape = { applicationId: applicationIdField };
const widgetIdShape = { ...applicationIdShape, widgetId: widgetIdField };

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
    by: z.enum(["role", "text", "name", "labelText"]).describe("Query type"),
    value: z.union([z.string(), z.number()]).describe("Value to search for"),
    options: queryOptionsSchema.optional().describe("Additional query options"),
};

const typeShape = {
    ...widgetIdShape,
    text: z.string().describe("Text to type"),
    clear: z.boolean().optional().describe("Clear existing text before typing"),
};

const fireEventShape = {
    ...widgetIdShape,
    signal: z.string().describe("GTK signal name to emit"),
    args: z.array(z.unknown()).optional().describe("Arguments to pass to the signal"),
};

const screenshotShape = {
    ...applicationIdShape,
    windowId: z.string().optional().describe("Window ID to capture. If not specified, captures the first window."),
};

const textContent = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });

const textError = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
});

const imageContent = (data: string, mimeType: string): CallToolResult => ({
    content: [{ type: "image", data, mimeType }],
});

type ToolHandlerResult = CallToolResult;

type ToolArgs<Shape extends Record<string, z.ZodType>> = { [K in keyof Shape]: z.output<Shape[K]> };

type ToolKind = "readOnly" | "action";

type TypedTool<Shape extends Record<string, z.ZodType>> = {
    name: string;
    title: string;
    kind: ToolKind;
    config: { description: string; inputSchema: Shape };
    handler: (args: ToolArgs<Shape>) => Promise<ToolHandlerResult>;
};

type ToolDefinition = {
    register: (server: McpServer) => void;
};

const hasStringHint = (data: unknown): data is { hint: string } =>
    typeof data === "object" && data !== null && "hint" in data && typeof data.hint === "string";

const runTool = async <Shape extends Record<string, z.ZodType>>(
    handler: (args: ToolArgs<Shape>) => Promise<ToolHandlerResult>,
    args: ToolArgs<Shape>,
): Promise<ToolHandlerResult> => {
    try {
        return await handler(args);
    } catch (error) {
        if (error instanceof IpcError) {
            return textError(hasStringHint(error.data) ? `${error.message}\n${error.data.hint}` : error.message);
        }
        return textError(error instanceof Error ? error.message : String(error));
    }
};

const defineTool = <Shape extends Record<string, z.ZodType>>(tool: TypedTool<Shape>): ToolDefinition => ({
    register: (server) => {
        const callback = ((args: ToolArgs<Shape>, _extra: unknown) =>
            runTool(tool.handler, args)) as ToolCallback<Shape>;
        server.registerTool(
            tool.name,
            {
                ...tool.config,
                annotations: {
                    title: tool.title,
                    readOnlyHint: tool.kind === "readOnly",
                    destructiveHint: tool.kind === "action",
                    openWorldHint: true,
                },
            },
            callback,
        );
    },
});

type ForwardOptions<Shape extends Record<string, z.ZodType>> = {
    name: string;
    title: string;
    kind: ToolKind;
    description: string;
    inputSchema: Shape;
    appRouter: AppRouter;
    method: ServerInitiatedMethod;
    params?: (args: ToolArgs<Shape>) => unknown;
};

const buildForwardParams = <Shape extends Record<string, z.ZodType>>(
    args: ToolArgs<Shape>,
    custom: ForwardOptions<Shape>["params"],
): { applicationId: string | undefined; params: unknown } => {
    const { applicationId, ...rest } = args as ToolArgs<Shape> & { applicationId?: string };
    return { applicationId, params: custom ? custom(args) : rest };
};

const forwardTool = <Shape extends Record<string, z.ZodType>>(
    options: ForwardOptions<Shape>,
    perform: (
        appRouter: AppRouter,
        applicationId: string | undefined,
        method: ServerInitiatedMethod,
        params: unknown,
    ) => Promise<ToolHandlerResult>,
): ToolDefinition =>
    defineTool<Shape>({
        name: options.name,
        title: options.title,
        kind: options.kind,
        config: { description: options.description, inputSchema: options.inputSchema },
        handler: async (args) => {
            const { applicationId, params } = buildForwardParams(args, options.params);
            return perform(options.appRouter, applicationId, options.method, params);
        },
    });

const forwardJson = <Shape extends Record<string, z.ZodType>>(options: ForwardOptions<Shape>): ToolDefinition =>
    forwardTool(options, async (appRouter, applicationId, method, params) => {
        const result = await appRouter.sendToApp(applicationId, method, params);
        return textContent(JSON.stringify(result, null, 2));
    });

const forwardAck = <Shape extends Record<string, z.ZodType>>(
    options: ForwardOptions<Shape> & { ack: string },
): ToolDefinition =>
    forwardTool(options, async (appRouter, applicationId, method, params) => {
        await appRouter.sendToApp(applicationId, method, params);
        return textContent(options.ack);
    });

const forwardImage = <Shape extends Record<string, z.ZodType>>(options: ForwardOptions<Shape>): ToolDefinition =>
    forwardTool(options, async (appRouter, applicationId, method, params) => {
        const result = await appRouter.sendToApp<{ data: string; mimeType: string }>(applicationId, method, params);
        return imageContent(result.data, result.mimeType);
    });

const listAppsTool = (appRouter: AppRouter) =>
    defineTool({
        name: "gtkx_list_apps",
        title: "List apps",
        kind: "readOnly",
        config: {
            description: "List all connected GTKX applications and their open windows.",
            inputSchema: listAppsShape,
        },
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

const getWidgetTreeTool = (appRouter: AppRouter) =>
    defineTool({
        name: "gtkx_get_widget_tree",
        title: "Widget tree",
        kind: "readOnly",
        config: {
            description:
                "Get the widget hierarchy for a connected GTKX app. Returns a tree of all widgets with their IDs, types, roles, and properties.",
            inputSchema: applicationIdShape,
        },
        handler: async ({ applicationId }) => {
            const result = await appRouter.sendToApp<{ tree: string }>(applicationId, "widget.getTree", {});
            return textContent(result.tree);
        },
    });

function buildInspectionTools(appRouter: AppRouter): ToolDefinition[] {
    return [
        listAppsTool(appRouter),
        getWidgetTreeTool(appRouter),
        forwardJson({
            name: "gtkx_query_widgets",
            title: "Query widgets",
            kind: "readOnly",
            description:
                "Find widgets by role, text, name, or label. Returns matching widgets with their IDs and properties.",
            inputSchema: queryWidgetsShape,
            appRouter,
            method: "widget.query",
        }),
        forwardJson({
            name: "gtkx_get_widget_props",
            title: "Get widget properties",
            kind: "readOnly",
            description: "Get all properties of a specific widget by its ID",
            inputSchema: widgetIdShape,
            appRouter,
            method: "widget.getProps",
        }),
        forwardImage({
            name: "gtkx_take_screenshot",
            title: "Take screenshot",
            kind: "readOnly",
            description:
                "Capture a screenshot of a window. Returns base64-encoded PNG image data. You can't target widgets from a screenshot; use `gtkx_get_widget_tree` to find widget IDs for interaction.",
            inputSchema: screenshotShape,
            appRouter,
            method: "widget.screenshot",
        }),
    ];
}

function buildInteractionTools(appRouter: AppRouter): ToolDefinition[] {
    return [
        forwardAck({
            name: "gtkx_click",
            title: "Click widget",
            kind: "action",
            description: "Click a widget. Works with buttons, checkboxes, and other interactive widgets.",
            inputSchema: widgetIdShape,
            appRouter,
            method: "widget.click",
            ack: "Clicked",
        }),
        forwardAck({
            name: "gtkx_type",
            title: "Type text",
            kind: "action",
            description: "Type text into an editable widget like Entry or TextView",
            inputSchema: typeShape,
            appRouter,
            method: "widget.type",
            ack: "Typed text",
        }),
        forwardAck({
            name: "gtkx_fire_event",
            title: "Fire event",
            kind: "action",
            description: "Emit a GTK signal on a widget. Use this for custom interactions.",
            inputSchema: fireEventShape,
            appRouter,
            method: "widget.fireEvent",
            ack: "Fired event",
        }),
    ];
}

function buildTools(appRouter: AppRouter): ToolDefinition[] {
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
            console.error("[gtkx] Socket error:", error.message);
        }
    });

    appRouter.on("appRegistered", (appInfo) => {
        console.error(`[gtkx] App registered: ${appInfo.applicationId} (PID: ${appInfo.pid})`);
    });

    appRouter.on("appUnregistered", (applicationId) => {
        console.error(`[gtkx] App unregistered: ${applicationId}`);
    });

    const mcpServer = new McpServer({ name: "gtkx-mcp", version: options.version });

    for (const tool of buildTools(appRouter)) {
        tool.register(mcpServer);
    }

    let stopped = false;

    return {
        async start() {
            await socketServer.start();
            console.error(`[gtkx] Socket server listening on ${socketPath}`);
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

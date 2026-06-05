import { createRequire } from "node:module";
import { installGracefulShutdown } from "@gtkx/utils";
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnectionManager } from "./connection-manager.js";
import { ConnectionRegistry } from "./connection-registry.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/types.js";
import { SocketServer } from "./socket-server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const APPLICATION_ID_DESCRIPTION = "Application ID to query. If not specified, uses the first connected app.";
const WIDGET_ID_DESCRIPTION = "Widget ID";

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
    options: z
        .object({
            name: z.string().optional(),
            exact: z.boolean().optional(),
            timeout: z.number().optional(),
        })
        .optional()
        .describe("Additional query options"),
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

/**
 * Narrow view of {@link ConnectionManager} consumed by the tool handlers. Each
 * tool needs only app discovery (`getApps`, `hasConnectedApps`, `waitForApp`)
 * and request forwarding (`sendToApp`).
 */
export type AppQueryClient = Pick<ConnectionManager, "getApps" | "hasConnectedApps" | "waitForApp" | "sendToApp">;

/**
 * Result envelope every tool handler returns to the MCP SDK. Aliased to the
 * SDK's `CallToolResult` so any drift between local handlers and the SDK's
 * structural contract is caught at compile time.
 */
type ToolHandlerResult = CallToolResult;

/**
 * The argument record received by a typed tool handler — mirrors the SDK's
 * `ShapeOutput<Shape>` (which is not part of the SDK's published exports) so
 * the resolved shape matches what the MCP server actually delivers.
 *
 * @typeParam Shape - The Zod raw shape used as the tool's `inputSchema`.
 */
type ToolArgs<Shape extends Record<string, z.ZodType>> = { [K in keyof Shape]: z.output<Shape[K]> };

/**
 * Internal, per-tool typed view used while a tool is being constructed: the
 * `Shape` parameter ties `inputSchema` to the `handler`'s argument record so
 * the SDK's structural contract is enforced inside {@link defineTool}.
 *
 * @typeParam Shape - The Zod raw shape used as the tool's `inputSchema`.
 */
type TypedTool<Shape extends Record<string, z.ZodType>> = {
    name: string;
    config: { description: string; inputSchema: Shape };
    handler: (args: ToolArgs<Shape>) => Promise<ToolHandlerResult>;
};

/**
 * A registered MCP tool as exposed to consumers (tests and the registration
 * loop in {@link main}). The per-tool `Shape` parameter is hidden behind the
 * `register` closure so heterogeneous tools can be stored in a single array
 * without type-erasing casts; the closure preserves the typed link between
 * `inputSchema` and `handler` at the point where it actually matters — the
 * call to {@link McpServer.registerTool}.
 */
export type ToolDefinition = {
    name: string;
    config: { description: string; inputSchema: z.ZodRawShape };
    handler: (args: never) => Promise<ToolHandlerResult>;
    register: (server: McpServer) => void;
};

/**
 * Builds a {@link ToolDefinition} from a typed tool spec. The SDK's
 * `registerTool` is called inside the returned closure with the original
 * `Shape` in scope; the only cast is a localized assertion to the SDK's
 * `ToolCallback<Shape>` (made necessary by the SDK's optional
 * `inputSchema?: InputArgs` widening to `undefined` during inference) that
 * still names the SDK type so renames in `ToolCallback` itself fail
 * compilation.
 *
 * @typeParam Shape - The Zod raw shape used as the tool's `inputSchema`.
 * @param tool - The typed tool spec (without `register`; it is added here).
 * @returns A shape-erased {@link ToolDefinition}.
 */
const defineTool = <Shape extends Record<string, z.ZodType>>(tool: TypedTool<Shape>): ToolDefinition => ({
    name: tool.name,
    config: tool.config,
    handler: tool.handler,
    register: (server) => {
        const callback = ((args: ToolArgs<Shape>, _extra: unknown) => tool.handler(args)) as ToolCallback<Shape>;
        server.registerTool(tool.name, tool.config, callback);
    },
});

type ForwardOptions<Shape extends Record<string, z.ZodType>> = {
    name: string;
    description: string;
    inputSchema: Shape;
    connectionManager: AppQueryClient;
    method: string;
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
        connectionManager: AppQueryClient,
        applicationId: string | undefined,
        method: string,
        params: unknown,
    ) => Promise<ToolHandlerResult>,
): ToolDefinition =>
    defineTool<Shape>({
        name: options.name,
        config: { description: options.description, inputSchema: options.inputSchema },
        handler: async (args) => {
            const { applicationId, params } = buildForwardParams(args, options.params);
            return perform(options.connectionManager, applicationId, options.method, params);
        },
    });

const forwardJson = <Shape extends Record<string, z.ZodType>>(options: ForwardOptions<Shape>): ToolDefinition =>
    forwardTool(options, async (connectionManager, applicationId, method, params) => {
        const result = await connectionManager.sendToApp(applicationId, method, params);
        return textContent(JSON.stringify(result, null, 2));
    });

const forwardAck = <Shape extends Record<string, z.ZodType>>(
    options: ForwardOptions<Shape> & { ack: string },
): ToolDefinition =>
    forwardTool(options, async (connectionManager, applicationId, method, params) => {
        await connectionManager.sendToApp(applicationId, method, params);
        return textContent(options.ack);
    });

const forwardImage = <Shape extends Record<string, z.ZodType>>(options: ForwardOptions<Shape>): ToolDefinition =>
    forwardTool(options, async (connectionManager, applicationId, method, params) => {
        const result = await connectionManager.sendToApp<{ data: string; mimeType: string }>(
            applicationId,
            method,
            params,
        );
        return imageContent(result.data, result.mimeType);
    });

const listAppsTool = (connectionManager: AppQueryClient) =>
    defineTool({
        name: "gtkx_list_apps",
        config: {
            description: "List all connected GTKX applications",
            inputSchema: listAppsShape,
        },
        handler: async ({ waitForApps, timeout }) => {
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

const getWidgetTreeTool = (connectionManager: AppQueryClient) =>
    defineTool({
        name: "gtkx_get_widget_tree",
        config: {
            description:
                "Get the widget hierarchy for a connected GTKX app. Returns a tree of all widgets with their IDs, types, roles, and properties.",
            inputSchema: applicationIdShape,
        },
        handler: async ({ applicationId }) => {
            const result = await connectionManager.sendToApp<{ tree: string }>(applicationId, "widget.getTree", {});
            return textContent(result.tree);
        },
    });

/**
 * Builds the GTKX MCP tool definitions, ready to be registered on a server.
 *
 * Exposed so tests can drive each tool handler against a fake
 * {@link ConnectionManager} without spinning up a real socket server.
 *
 * @param connectionManager - Connection manager that proxies tool requests to the connected
 *   GTKX application.
 * @returns Array of tool definitions in registration order.
 */
export function buildTools(connectionManager: AppQueryClient): ToolDefinition[] {
    return [
        listAppsTool(connectionManager),
        getWidgetTreeTool(connectionManager),
        forwardJson({
            name: "gtkx_query_widgets",
            description:
                "Find widgets by role, text, name, or label. Returns matching widgets with their IDs and properties.",
            inputSchema: queryWidgetsShape,
            connectionManager,
            method: "widget.query",
            params: ({ by, value, options }) => ({ queryType: by, value, options }),
        }),
        forwardJson({
            name: "gtkx_get_widget_props",
            description: "Get all properties of a specific widget by its ID",
            inputSchema: widgetIdShape,
            connectionManager,
            method: "widget.getProps",
        }),
        forwardAck({
            name: "gtkx_click",
            description: "Click a widget. Works with buttons, checkboxes, and other interactive widgets.",
            inputSchema: widgetIdShape,
            connectionManager,
            method: "widget.click",
            ack: "Click successful",
        }),
        forwardAck({
            name: "gtkx_type",
            description: "Type text into an editable widget like Entry or TextView",
            inputSchema: typeShape,
            connectionManager,
            method: "widget.type",
            ack: "Type successful",
        }),
        forwardAck({
            name: "gtkx_fire_event",
            description: "Emit a GTK signal on a widget. Use this for custom interactions.",
            inputSchema: fireEventShape,
            connectionManager,
            method: "widget.fireEvent",
            ack: "Event fired successfully",
        }),
        forwardImage({
            name: "gtkx_take_screenshot",
            description: "Capture a screenshot of a window. Returns base64-encoded PNG image data.",
            inputSchema: screenshotShape,
            connectionManager,
            method: "widget.screenshot",
        }),
    ];
}

/**
 * Configuration for {@link createMcpServer}.
 */
export type CreateMcpServerOptions = {
    /** Unix-domain socket path the server listens on. */
    socketPath?: string;
    /** Version reported to MCP clients. */
    version: string;
};

/**
 * Runtime handle returned by {@link createMcpServer}.
 */
export type McpServerHandle = {
    /** Starts the socket server and connects the MCP stdio transport. */
    start(): Promise<void>;
    /**
     * Tears down the connection manager, socket server, and MCP SDK server.
     * Idempotent.
     */
    stop(): Promise<void>;
};

/**
 * Builds a configured GTKX MCP server, wiring the socket listener, the
 * connection registry, the connection manager, and the MCP SDK server.
 * Returns lifecycle hooks the caller invokes to start and stop the server.
 *
 * The shape is intentionally testable: `createMcpServer` is what tests drive,
 * `main` is the thin shell that adds signal handling on top.
 *
 * @param options - Server configuration.
 * @returns A handle exposing `start` and `stop`.
 */
export const createMcpServer = (options: CreateMcpServerOptions): McpServerHandle => {
    const socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;

    const registry = new ConnectionRegistry();
    const socketServer = new SocketServer(registry, socketPath);
    const connectionManager = new ConnectionManager(registry);

    registry.on("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPIPE" && code !== "ECONNRESET") {
            console.error("[gtkx] Socket error:", error.message);
        }
    });

    connectionManager.on("appRegistered", (appInfo) => {
        console.error(`[gtkx] App registered: ${appInfo.applicationId} (PID: ${appInfo.pid})`);
    });

    connectionManager.on("appUnregistered", (applicationId) => {
        console.error(`[gtkx] App unregistered: ${applicationId}`);
    });

    const mcpServer = new McpServer({ name: "gtkx-mcp", version: options.version });

    for (const tool of buildTools(connectionManager)) {
        tool.register(mcpServer);
    }

    let stopped = false;

    return {
        async start() {
            await socketServer.start();
            console.error(`[gtkx] Socket server listening on ${socketPath}`);
            const transport = new StdioServerTransport();
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

/**
 * Bootstraps the GTKX MCP server: builds it, installs the shared graceful
 * shutdown helper, and awaits the listening socket.
 */
export async function main() {
    const server = createMcpServer({ version });
    installGracefulShutdown({
        onSignal: () => server.stop(),
    });
    await server.start();
}

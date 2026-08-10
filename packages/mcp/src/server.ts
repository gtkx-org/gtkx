import { createLogger, installGracefulShutdown, type Logger } from "@gtkx/utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { z } from "zod";
import type { ConnectionErrorEvent } from "./transport.js";
import { type AppRegisteredEvent, AppRouter, type AppUnregisteredEvent } from "./app-router.js";
import { ConnectionRegistry } from "./connection-registry.js";
import {
    type AppInfo,
    DEFAULT_SOCKET_PATH,
    DEFAULT_SUBTREE_DEPTH,
    fireEventParams,
    MAX_SUBTREE_WIDGETS,
    queryParams,
    screenshotParams,
    treeParams,
    typeParams,
    widgetIdParams,
    widgetPropsParams,
} from "./protocol/schemas.js";
import {
    buildReferenceTools,
    createReferenceProvider,
    type ReferenceProvider,
    registerReferenceResources,
} from "./reference.js";
import { SocketServer } from "./socket-server.js";
import { defineTool, imageContent, registerTool, textContent, type Tool } from "./tool.js";

type CreateMcpServerOptions = {
    socketPath?: string;
    version: string;
};

type McpServerHandle = {
    start(): Promise<void>;
    stop(): Promise<void>;
};

type ServerLifecycle = {
    socketServer: SocketServer;
    mcpServer: McpServer;
    socketPath: string;
    isStopped: boolean;
    isStarted: boolean;
};

type AppWindow = { id: string; title: string | null };
type AppWithWindows = AppInfo & { windows?: AppWindow[] };

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
const log: Logger = createLogger("mcp");
const APPLICATION_ID_DESCRIPTION = "Application ID to query. If not specified, uses the first connected app.";

const WIDGET_ID_DESCRIPTION =
    "Widget ID obtained from `gtkx_get_widget_tree`, `gtkx_query_widgets`, or `gtkx_get_widget_props`. " +
    "IDs are scoped to a single app. An ID stays valid for as long as its widget is mounted and stops " +
    "resolving once the widget is unmounted.";

const applicationIdShape = { applicationId: z.string().optional().describe(APPLICATION_ID_DESCRIPTION) };

const widgetIdShape = {
    ...applicationIdShape,
    ...describeParams(widgetIdParams.shape, { widgetId: WIDGET_ID_DESCRIPTION }),
};

const widgetPropsShape = {
    ...applicationIdShape,
    ...describeParams(widgetPropsParams.shape, {
        widgetId: WIDGET_ID_DESCRIPTION,
        properties:
            "GObject property names to read as well, in kebab-case or camelCase (\"current-breakpoint\" or " +
            "\"currentBreakpoint\"). Omit for the summary alone.",
        maxDepth:
            `How many levels of descendants to include: ${String(DEFAULT_SUBTREE_DEPTH)} by default, and 0 ` +
            `for the widget on its own. At most ${String(MAX_SUBTREE_WIDGETS)} widgets come back whatever ` +
            "the depth, and any widget whose own direct children were left out carries a `hiddenChildren` count.",
    }),
};

const treeShape = {
    ...applicationIdShape,
    ...describeParams(treeParams.shape, {
        rootId:
            "Render only the subtree rooted at this widget ID (from a prior tree or query). Omit for the " +
            "whole app.",
        maxDepth:
            "Limit how many levels deep to render, and 0 for the root widget on its own; deeper " +
            "descendants are summarized with a count. Combine with rootId to drill in without dumping " +
            "the whole tree.",
    }),
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
    ...describeParams(queryParams.shape, {
        by: "Query type",
        value: "Value to search for",
        options: "Additional query options",
    }),
};

const typeShape = {
    ...applicationIdShape,
    ...describeParams(typeParams.shape, {
        widgetId: WIDGET_ID_DESCRIPTION,
        text: "Text to type",
        clear: "Clear existing text before typing",
    }),
};

const fireEventShape = {
    ...applicationIdShape,
    ...describeParams(fireEventParams.shape, {
        widgetId: WIDGET_ID_DESCRIPTION,
        signal: "GTK4 signal name to emit",
        args: "Arguments to pass to the signal",
    }),
};

const screenshotShape = {
    ...applicationIdShape,
    ...describeParams(screenshotParams.shape, {
        windowId: "Window ID to capture. If not specified, captures the first window.",
        path:
            "Absolute path to write the PNG to on the app's machine. If set, the screenshot is saved there " +
            "in addition to being returned.",
    }),
};

function describeParams<Shape extends Record<string, z.ZodType>>(
    shape: Shape,
    descriptions: { [Key in keyof Shape]: string },
): Shape {
    const described: [string, z.ZodType][] = Object.entries(shape).map(([key, schema]) => [
        key,
        schema.describe(descriptions[key as keyof Shape]),
    ]);

    return Object.fromEntries(described) as Shape;
}

const connectStdio = async (mcpServer: McpServer, stop: () => Promise<void>): Promise<void> => {
    const transport = new StdioServerTransport();
    process.stdin.on("end", () => void stop());
    process.stdin.on("close", () => void stop());
    await mcpServer.connect(transport);
};

const logSocketError = (event: Event): void => {
    const error = (event as ConnectionErrorEvent).detail;
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "EPIPE" || code === "ECONNRESET") {
        return;
    }

    log.error(`socket error: ${error.message}`);
};

const appWithWindows = async (appRouter: AppRouter, app: AppInfo): Promise<AppWithWindows> => {
    try {
        const result = await appRouter.sendToApp<{ windows: AppWindow[] }>(
            app.applicationId,
            "app.getWindows",
            {},
        );

        return { ...app, windows: result.windows };
    } catch {
        return app;
    }
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
            const appsWithWindows = await Promise.all(apps.map((app) => appWithWindows(appRouter, app)));

            return textContent(JSON.stringify(appsWithWindows, null, 2));
        },
    });

const screenshotTool = (appRouter: AppRouter): Tool =>
    defineTool({
        name: "gtkx_take_screenshot",
        title: "Take screenshot",
        kind: "readOnly",
        description:
            "Capture a screenshot of a window. Returns base64-encoded PNG image data, and optionally writes " +
            "the PNG to `path` on the app's machine. You can't target widgets from a screenshot; use " +
            "`gtkx_get_widget_tree` to find widget IDs for interaction.",
        inputSchema: screenshotShape,
        handler: async ({ applicationId, ...params }) => {
            const result = await appRouter.sendToApp<{ data: string; mimeType: string; savedPath?: string }>(
                applicationId,
                "widget.screenshot",
                params,
            );

            if (result.savedPath) {
                return {
                    content: [
                        { type: "text", text: `Screenshot saved to ${result.savedPath}` },
                        { type: "image", data: result.data, mimeType: result.mimeType },
                    ],
                };
            }

            return imageContent(result.data, result.mimeType);
        },
    });

const widgetPropsTool = (appRouter: AppRouter): Tool =>
    defineTool({
        name: "gtkx_get_widget_props",
        title: "Get widget properties",
        kind: "readOnly",
        description:
            "Get a fixed summary of one widget by ID: type, accessible role, name, text, sensitivity, " +
            "visibility, CSS classes, and the same summary for its descendants. The subtree is bounded " +
            `twice: ${String(DEFAULT_SUBTREE_DEPTH)} levels deep unless \`maxDepth\` says otherwise, and ` +
            `${String(MAX_SUBTREE_WIDGETS)} widgets in all, filled breadth first. Wherever either bound ` +
            "cut a branch, that widget carries `hiddenChildren`, the count of its own direct children left " +
            "out rather than of everything below them; call again with that widget's ID to drill in, or " +
            "use `gtkx_get_widget_tree` for a wider map. Pass `properties` to read GObject properties too; " +
            "they come back first in the payload, each under its canonical kebab-case name as " +
            "`{type, value}`, where an enum or flags value is its GType value name, a 64-bit integer a " +
            "decimal string, and an object its GType name plus `widgetId` when it is a widget. Asking for " +
            "a property the widget does not have fails; a value that cannot be marshalled carries a `note` " +
            "instead.",
        inputSchema: widgetPropsShape,
        handler: async ({ applicationId, ...params }) => {
            const result = await appRouter.sendToApp(applicationId, "widget.getProps", params);

            return textContent(JSON.stringify(result, null, 2));
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
                "Get the widget hierarchy for a connected GTKX app. Returns a tree of widgets with their IDs, " +
                "types, roles, and properties. For large apps, pass `maxDepth` for a shallow overview and/or " +
                "`rootId` to render just one subtree instead of the whole (possibly truncated) tree.",
            inputSchema: treeShape,
            handler: async ({ applicationId, rootId, maxDepth }) => {
                const result = await appRouter.sendToApp<{ tree: string }>(applicationId, "widget.getTree", {
                    rootId,
                    maxDepth,
                });

                return textContent(result.tree);
            },
        }),
        defineTool({
            name: "gtkx_query_widgets",
            title: "Query widgets",
            kind: "readOnly",
            description:
                "Find widgets by role, text, name, or label. Returns each match with its ID and the same " +
                "fixed summary `gtkx_get_widget_props` returns, with no descendants: a match that has " +
                "children carries `hiddenChildren`, the count of its direct children left out. Read a " +
                "match's subtree with `gtkx_get_widget_props` or `gtkx_get_widget_tree`.",
            inputSchema: queryWidgetsShape,
            handler: async ({ applicationId, ...params }) => {
                const result = await appRouter.sendToApp(applicationId, "widget.query", params);

                return textContent(JSON.stringify(result, null, 2));
            },
        }),
        widgetPropsTool(appRouter),
        screenshotTool(appRouter),
    ];
}

function buildInteractionTools(appRouter: AppRouter): Tool[] {
    return [
        defineTool({
            name: "gtkx_click",
            title: "Click widget",
            kind: "action",
            description:
                "Click a widget through userEvent.click, with no special case per widget. Works with " +
                "buttons, checkboxes, switches, list and grid rows, tree expanders, and column headers: a " +
                "row is selected, an expander toggles its row's expansion, and a header sorts its column.",
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
            description: "Emit a GTK4 signal on a widget. Use this for custom interactions.",
            inputSchema: fireEventShape,
            handler: async ({ applicationId, ...params }) => {
                const result = await appRouter.sendToApp(applicationId, "widget.fireEvent", params);

                return textContent(JSON.stringify(result, null, 2));
            },
        }),
    ];
}

function buildTools(appRouter: AppRouter): Tool[] {
    return [...buildInspectionTools(appRouter), ...buildInteractionTools(appRouter)];
}

const registerTools = (mcpServer: McpServer, appRouter: AppRouter, provider: ReferenceProvider): void => {
    for (const tool of [...buildTools(appRouter), ...buildReferenceTools(provider)]) {
        registerTool(mcpServer, tool);
    }
};

async function stopServer(state: ServerLifecycle): Promise<void> {
    if (state.isStopped) {
        return;
    }

    state.isStopped = true;
    await state.socketServer.stop();
    await state.mcpServer.close();
}

async function startServer(state: ServerLifecycle): Promise<void> {
    if (state.isStopped) {
        throw new Error("createMcpServer: a stopped server cannot be started again");
    }

    await state.socketServer.start();

    if (state.isStarted) {
        return;
    }

    state.isStarted = true;
    log.info(`socket server listening on ${state.socketPath}`);
    await connectStdio(state.mcpServer, () => stopServer(state));
}

const createServerHandle = (socketServer: SocketServer, mcpServer: McpServer, socketPath: string): McpServerHandle => {
    const state: ServerLifecycle = { socketServer, mcpServer, socketPath, isStopped: false, isStarted: false };

    return { start: () => startServer(state), stop: () => stopServer(state) };
};

const createMcpServer = (options: CreateMcpServerOptions): McpServerHandle => {
    const socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;
    const registry = new ConnectionRegistry();
    const socketServer = new SocketServer(registry, socketPath);
    const appRouter = new AppRouter(registry);
    registry.addEventListener("error", logSocketError);

    appRouter.addEventListener("appRegistered", (event) => {
        const appInfo = (event as AppRegisteredEvent).detail;
        log.info(`app registered: ${appInfo.applicationId} (PID: ${String(appInfo.pid)})`);
    });

    appRouter.addEventListener("appUnregistered", (event) => {
        log.info(`app unregistered: ${(event as AppUnregisteredEvent).detail}`);
    });

    const mcpServer = new McpServer({ name: "gtkx-mcp", version: options.version });
    const referenceProvider = createReferenceProvider({ getAppRoot: () => appRouter.getProjectRoot() });
    registerTools(mcpServer, appRouter, referenceProvider);
    registerReferenceResources(mcpServer, referenceProvider);

    return createServerHandle(socketServer, mcpServer, socketPath);
};

async function main(): Promise<void> {
    const server = createMcpServer({ version });

    installGracefulShutdown({
        onSignal: () => server.stop(),
    });

    await server.start();
}

export { log, createMcpServer, main };

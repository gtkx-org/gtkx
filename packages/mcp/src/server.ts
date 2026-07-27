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
    fireEventParams,
    queryParams,
    screenshotParams,
    treeParams,
    typeParams,
    widgetIdParams,
} from "./protocol/schemas.js";
import { buildReferenceTools, createReferenceProvider, registerReferenceResources } from "./reference.js";
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
    widgetId: widgetIdParams.shape.widgetId.describe(WIDGET_ID_DESCRIPTION),
};

const treeShape = {
    ...applicationIdShape,
    rootId: treeParams.shape.rootId.describe(
        "Render only the subtree rooted at this widget ID (from a prior tree or query). Omit for the whole app.",
    ),
    maxDepth: treeParams.shape.maxDepth.describe(
        "Limit how many levels deep to render; deeper descendants are summarized with a count. " +
        "Combine with rootId to drill in without dumping the whole tree.",
    ),
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
    signal: fireEventParams.shape.signal.describe("GTK4 signal name to emit"),
    args: fireEventParams.shape.args.describe("Arguments to pass to the signal"),
};

const screenshotShape = {
    ...applicationIdShape,
    windowId: screenshotParams.shape.windowId.describe(
        "Window ID to capture. If not specified, captures the first window.",
    ),
    path: screenshotParams.shape.path.describe(
        "Absolute path to write the PNG to on the app's machine. If set, the screenshot is saved there " +
        "in addition to being returned.",
    ),
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
            description:
                "Get a fixed summary of one widget by ID: type, accessible role, name, text, sensitivity, " +
                "visibility, CSS classes, and the full subtree of descendant widgets. It does not return " +
                "arbitrary GObject properties.",
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
            description: "Emit a GTK4 signal on a widget. Use this for custom interactions.",
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
    const referenceProvider = createReferenceProvider(() => appRouter.getProjectRoot() ?? process.cwd());

    for (const tool of [...buildTools(appRouter), ...buildReferenceTools(referenceProvider)]) {
        registerTool(mcpServer, tool);
    }

    registerReferenceResources(mcpServer, referenceProvider);
    let isStopped = false;

    const stop = async (): Promise<void> => {
        if (isStopped) {
            return;
        }

        isStopped = true;
        await socketServer.stop();
        await mcpServer.close();
    };

    const start = async (): Promise<void> => {
        await socketServer.start();
        log.info(`socket server listening on ${socketPath}`);
        const transport = new StdioServerTransport();
        process.stdin.on("end", () => void stop());
        process.stdin.on("close", () => void stop());
        await mcpServer.connect(transport);
    };

    return { start, stop };
};

async function main(): Promise<void> {
    const server = createMcpServer({ version });

    installGracefulShutdown({
        onSignal: () => server.stop(),
    });

    await server.start();
}

export { log, createMcpServer, main };

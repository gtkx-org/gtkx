import * as Gtk from "@gtkx/gi/gtk";
import { type IpcMethod, methodNotFoundError, widgetNotFoundError } from "@gtkx/mcp";
import { loadTestingModule } from "./testing-loader.js";
import type { WidgetRegistry } from "./widget-registry.js";

/**
 * Context every handler receives: the app the entry registered and the
 * client-scoped widget registry.
 */
export type HandlerContext = {
    app: Gtk.Application;
    registry: WidgetRegistry;
};

/**
 * Function signature implemented by every entry in {@link HANDLERS}.
 */
type Handler = (ctx: HandlerContext, params: unknown) => Promise<unknown>;

const requireWidget = (registry: WidgetRegistry, widgetId: string | undefined): Gtk.Widget => {
    if (widgetId === undefined) {
        throw widgetNotFoundError("undefined");
    }
    const widget = registry.get(widgetId);
    if (!widget) {
        throw widgetNotFoundError(widgetId);
    }
    return widget;
};

const extractSignalArg = (arg: unknown): unknown => {
    const isTypedArg = typeof arg === "object" && arg !== null && "type" in arg && "value" in arg;
    return isTypedArg ? (arg as { value: unknown }).value : arg;
};

const handleQuery: Handler = async ({ app, registry }, params) => {
    const testing = await loadTestingModule();
    const p = params as { queryType: string; value: string | number; options?: Record<string, unknown> };
    let widgets: Gtk.Widget[] = [];

    switch (p.queryType) {
        case "role": {
            const roleValue =
                typeof p.value === "string" ? Gtk.AccessibleRole[p.value as keyof typeof Gtk.AccessibleRole] : p.value;
            widgets = await testing.findAllByRole(app, roleValue as Gtk.AccessibleRole, p.options);
            break;
        }
        case "text":
            widgets = await testing.findAllByText(app, String(p.value), p.options);
            break;
        case "name":
            widgets = await testing.findAllByName(app, String(p.value), p.options);
            break;
        case "labelText":
            widgets = await testing.findAllByLabelText(app, String(p.value), p.options);
            break;
        default:
            throw new Error(`Unknown query type: ${p.queryType}`);
    }

    return { widgets: widgets.map((w) => registry.serialize(w)) };
};

const handleScreenshot: Handler = async ({ app, registry }, params) => {
    const testing = await loadTestingModule();
    const p = params as { windowId?: string };
    const targetWindow = p.windowId ? (requireWidget(registry, p.windowId) as Gtk.Window) : firstWindow(app);
    const result = await testing.screenshot(targetWindow);
    return { data: result.data, mimeType: result.mimeType };
};

const firstWindow = (app: Gtk.Application): Gtk.Window => {
    const [window] = app.getWindows();
    if (!window) {
        throw new Error("No windows available for screenshot");
    }
    return window;
};

/**
 * Subset of {@link IpcMethod} the MCP server can send to a client.
 *
 * `app.register` and `app.unregister` are sent only in the client→server
 * direction, so they are intentionally absent from the dispatch table.
 */
type ServerInitiatedMethod = Exclude<IpcMethod, "app.register" | "app.unregister">;

/**
 * Dispatch table mapping every server-initiated method to its handler. The
 * `Record` (rather than `Partial<Record>`) shape makes coverage a
 * compile-time guarantee — adding a new {@link ServerInitiatedMethod}
 * without a matching entry is a type error.
 */
const HANDLERS: Record<ServerInitiatedMethod, Handler> = {
    "app.getWindows": async ({ registry }) => {
        const windows = Gtk.Window.listToplevels();
        return {
            windows: windows.map((w) => ({
                id: registry.idFor(w),
                title: (w as Gtk.Window).getTitle?.() ?? null,
            })),
        };
    },
    "widget.getTree": async ({ app }) => {
        const testing = await loadTestingModule();
        return { tree: testing.prettyWidget(app, { includeIds: true, highlight: false }) };
    },
    "widget.query": handleQuery,
    "widget.getProps": async ({ registry }, params) => {
        const widget = requireWidget(registry, (params as { widgetId: string }).widgetId);
        return registry.serialize(widget);
    },
    "widget.click": async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const widget = requireWidget(registry, (params as { widgetId: string }).widgetId);
        await testing.userEvent.click(widget);
        return { success: true };
    },
    "widget.type": async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const p = params as { widgetId: string; text: string; clear?: boolean };
        const widget = requireWidget(registry, p.widgetId);
        if (p.clear) {
            await testing.userEvent.clear(widget);
        }
        await testing.userEvent.type(widget, p.text);
        return { success: true };
    },
    "widget.fireEvent": async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const p = params as { widgetId: string; signal: string; args?: unknown[] };
        const widget = requireWidget(registry, p.widgetId);
        const signalArgs = (p.args ?? []).map(extractSignalArg);
        await testing.fireEvent(widget, p.signal, ...signalArgs);
        return { success: true };
    },
    "widget.screenshot": handleScreenshot,
};

/**
 * Resolves an incoming method name to a handler and runs it.
 *
 * @param method - The IPC method requested by the MCP server.
 * @param params - Method-specific parameters.
 * @param ctx - Shared handler context for this dispatch.
 * @throws `methodNotFoundError` if no handler is registered for `method`.
 */
export const dispatch = async (method: string, params: unknown, ctx: HandlerContext): Promise<unknown> => {
    const handler = HANDLERS[method as ServerInitiatedMethod];
    if (!handler) {
        throw methodNotFoundError(method);
    }
    return handler(ctx, params);
};

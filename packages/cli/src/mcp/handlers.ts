import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as Gtk from "@gtkx/gi/gtk";
import {
    invalidRequestError,
    methodNotFoundError,
    type ParamsSchema,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
    widgetNotFoundError,
} from "@gtkx/mcp/internal";
import { serializeWidget } from "./serialize-widget.js";
import { loadTestingModule } from "./testing-loader.js";
import type { WidgetRegistry } from "./widget-registry.js";

export type HandlerContext = {
    app: Gtk.Application;
    registry: WidgetRegistry;
};

type ValidatedHandler = (ctx: HandlerContext, params: unknown) => Promise<unknown>;

const validated = <Params>(
    schema: ParamsSchema<Params>,
    handler: (ctx: HandlerContext, params: Params) => Promise<unknown>,
): ValidatedHandler => {
    return (ctx, params) => {
        const parsed = schema.safeParse(params ?? {});
        if (!parsed.success) {
            throw invalidRequestError(parsed.error.message);
        }
        return handler(ctx, parsed.data);
    };
};

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

const handleQuery = async (
    { app, registry }: HandlerContext,
    params: ServerRequestParams<"widget.query">,
): Promise<unknown> => {
    const testing = await loadTestingModule();
    let widgets: Gtk.Widget[] = [];

    switch (params.by) {
        case "role": {
            const roleValue =
                typeof params.value === "string"
                    ? Gtk.AccessibleRole[params.value as keyof typeof Gtk.AccessibleRole]
                    : params.value;
            widgets = await testing.findAllByRole(app, roleValue as Gtk.AccessibleRole, params.options);
            break;
        }
        case "text":
            widgets = await testing.findAllByText(app, String(params.value), params.options);
            break;
        case "name":
            widgets = await testing.findAllByName(app, String(params.value), params.options);
            break;
        case "labelText":
            widgets = await testing.findAllByLabelText(app, String(params.value), params.options);
            break;
    }

    return { widgets: widgets.map((w) => serializeWidget(w, (widget) => registry.idFor(widget), testing)) };
};

const defaultScreenshotTarget = (registry: WidgetRegistry): Gtk.Widget => {
    const [toplevel] = registry.toplevels();
    if (!toplevel) {
        throw new Error("No windows available for screenshot");
    }
    return toplevel;
};

const handleScreenshot = async (
    { registry }: HandlerContext,
    params: ServerRequestParams<"widget.screenshot">,
): Promise<unknown> => {
    const testing = await loadTestingModule();
    const target = params.windowId ? requireWidget(registry, params.windowId) : defaultScreenshotTarget(registry);
    const result = await testing.screenshot(target);
    if (params.path) {
        mkdirSync(dirname(params.path), { recursive: true });
        writeFileSync(params.path, Buffer.from(result.data, "base64"));
        return { data: result.data, mimeType: result.mimeType, savedPath: params.path };
    }
    return { data: result.data, mimeType: result.mimeType };
};

const HANDLERS: Record<ServerInitiatedMethod, ValidatedHandler> = {
    "app.getWindows": validated(ServerRequestParamsSchemas["app.getWindows"], async ({ registry }) => ({
        windows: registry.toplevels().map((window) => ({
            id: registry.idFor(window),
            title: window.getTitle(),
        })),
    })),
    "widget.getTree": validated(ServerRequestParamsSchemas["widget.getTree"], async ({ app, registry }) => {
        const testing = await loadTestingModule();
        return { tree: testing.prettyWidget(app, { getId: (w) => registry.idFor(w), highlight: false }) };
    }),
    "widget.query": validated(ServerRequestParamsSchemas["widget.query"], handleQuery),
    "widget.getProps": validated(ServerRequestParamsSchemas["widget.getProps"], async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const widget = requireWidget(registry, params.widgetId);
        return serializeWidget(widget, (target) => registry.idFor(target), testing);
    }),
    "widget.click": validated(ServerRequestParamsSchemas["widget.click"], async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const widget = requireWidget(registry, params.widgetId);
        await testing.userEvent.click(widget);
        return { success: true };
    }),
    "widget.type": validated(ServerRequestParamsSchemas["widget.type"], async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const widget = requireWidget(registry, params.widgetId);
        if (params.clear) {
            await testing.userEvent.clear(widget);
        }
        await testing.userEvent.type(widget, params.text);
        return { success: true };
    }),
    "widget.fireEvent": validated(ServerRequestParamsSchemas["widget.fireEvent"], async ({ registry }, params) => {
        const testing = await loadTestingModule();
        const widget = requireWidget(registry, params.widgetId);
        const signalArgs = (params.args ?? []).map(extractSignalArg);
        await testing.fireEvent(widget, params.signal, ...signalArgs);
        return { success: true };
    }),
    "widget.screenshot": validated(ServerRequestParamsSchemas["widget.screenshot"], handleScreenshot),
};

const isServerInitiatedMethod = (method: string): method is ServerInitiatedMethod =>
    Object.hasOwn(ServerRequestParamsSchemas, method);

export const dispatch = async (method: string, params: unknown, ctx: HandlerContext): Promise<unknown> => {
    if (!isServerInitiatedMethod(method)) {
        throw methodNotFoundError(method);
    }
    return HANDLERS[method](ctx, params);
};

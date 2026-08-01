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
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { WidgetRegistry } from "./widget-registry.js";
import { serializeWidget } from "./serialize-widget.js";
import { loadTestingModule, type TestingModule } from "./testing-loader.js";

type HandlerContext = {
    app: Gtk.Application;
    registry: WidgetRegistry;
};

type ValidatedHandler = (ctx: HandlerContext, params: unknown) => Promise<unknown>;
type WidgetTarget = { testing: TestingModule; widget: Gtk.Widget };

const HANDLERS: Record<ServerInitiatedMethod, ValidatedHandler> = {
    "app.getWindows": validated(ServerRequestParamsSchemas["app.getWindows"], ({ registry }) =>
        Promise.resolve({
            windows: registry.toplevels().map((window) => ({
                id: registry.getOrCreateId(window),
                title: window.getTitle(),
            })),
        })),
    "widget.getTree": validated(ServerRequestParamsSchemas["widget.getTree"], async ({ app, registry }, params) => {
        const testing = await loadTestingModule();
        const container = params.rootId === undefined ? app : requireWidget(registry, params.rootId);

        return {
            tree: testing.prettyWidget(container, {
                getId: (w) => registry.getOrCreateId(w),
                shouldHighlight: false,
                ...((params.maxDepth !== undefined) && { maxDepth: params.maxDepth }),
            }),
        };
    }),
    "widget.query": validated(ServerRequestParamsSchemas["widget.query"], handleQuery),
    "widget.getProps": validated(ServerRequestParamsSchemas["widget.getProps"], async ({ registry }, params) => {
        const { testing, widget } = await widgetTarget(registry, params.widgetId);

        return serializeWidget(widget, (target) => registry.getOrCreateId(target), testing);
    }),
    "widget.click": validated(ServerRequestParamsSchemas["widget.click"], async ({ registry }, params) => {
        const { testing, widget } = await widgetTarget(registry, params.widgetId);
        await testing.userEvent.click(widget);

        return { success: true };
    }),
    "widget.type": validated(ServerRequestParamsSchemas["widget.type"], async ({ registry }, params) => {
        const { testing, widget } = await widgetTarget(registry, params.widgetId);

        if (params.clear) {
            await testing.userEvent.clear(widget);
        }

        await testing.userEvent.type(widget, params.text);

        return { success: true };
    }),
    "widget.fireEvent": validated(ServerRequestParamsSchemas["widget.fireEvent"], async ({ registry }, params) => {
        const { testing, widget } = await widgetTarget(registry, params.widgetId);
        const signalArgs = (params.args ?? []).map((arg) => extractSignalArg(arg));
        await testing.fireEvent(widget, params.signal, ...signalArgs);

        return { success: true };
    }),
    "widget.screenshot": validated(ServerRequestParamsSchemas["widget.screenshot"], handleScreenshot),
};

function validated<Params>(
    schema: ParamsSchema<Params>,
    handler: (ctx: HandlerContext, params: Params) => Promise<unknown>,
): ValidatedHandler {
    return (ctx, params) => {
        const parsed = schema.safeParse(params ?? {});

        if (!parsed.success) {
            throw invalidRequestError(parsed.error.message);
        }

        return handler(ctx, parsed.data);
    };
}

const widgetTarget = async (registry: WidgetRegistry, widgetId: string | undefined): Promise<WidgetTarget> => ({
    testing: await loadTestingModule(),
    widget: requireWidget(registry, widgetId),
});

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

const resolveRole = (value: string | number): Gtk.AccessibleRole | undefined => {
    if (typeof value === "number") {
        return value;
    }

    const resolved = Gtk.AccessibleRole[value.toUpperCase() as keyof typeof Gtk.AccessibleRole];

    return typeof resolved === "number" ? resolved : undefined;
};

const matchesOrEmpty = async (find: () => Promise<Gtk.Widget[]>): Promise<Gtk.Widget[]> => {
    try {
        return await find();
    } catch {
        return [];
    }
};

async function handleQuery(
    { app, registry }: HandlerContext,
    params: ServerRequestParams<"widget.query">,
): Promise<unknown> {
    const testing = await loadTestingModule();
    let widgets: Gtk.Widget[] = [];

    switch (params.by) {
        case "role": {
            const roleValue = resolveRole(params.value);

            if (roleValue === undefined) {
                throw invalidRequestError(
                    `Unknown accessible role "${String(params.value)}"; use the lowercase role shown in the ` +
                    "widget tree, e.g. \"button\", \"list\", \"list_item\", or \"checkbox\".",
                );
            }

            widgets = await matchesOrEmpty(() => testing.findAllByRole(app, roleValue, params.options));
            break;
        }
        case "text": {
            widgets = await matchesOrEmpty(() => testing.findAllByText(app, String(params.value), params.options));
            break;
        }
        case "name": {
            widgets = await matchesOrEmpty(() => testing.findAllByName(app, String(params.value), params.options));
            break;
        }
        case "labelText": {
            widgets = await matchesOrEmpty(() => testing.findAllByLabelText(app, String(params.value), params.options));
            break;
        }
    }

    return { widgets: widgets.map((w) => serializeWidget(w, (widget) => registry.getOrCreateId(widget), testing, 0)) };
}

const defaultScreenshotTarget = (registry: WidgetRegistry): Gtk.Widget => {
    const [toplevel] = registry.toplevels();

    if (!toplevel) {
        throw new Error("No windows available for screenshot");
    }

    return toplevel;
};

async function handleScreenshot(
    { registry }: HandlerContext,
    params: ServerRequestParams<"widget.screenshot">,
): Promise<unknown> {
    const testing = await loadTestingModule();
    const target = params.windowId ? requireWidget(registry, params.windowId) : defaultScreenshotTarget(registry);
    const result = await testing.screenshot(target);

    if (params.path) {
        mkdirSync(dirname(params.path), { recursive: true });
        writeFileSync(params.path, Buffer.from(result.data, "base64"));

        return { data: result.data, mimeType: result.mimeType, savedPath: params.path };
    }

    return { data: result.data, mimeType: result.mimeType };
}

const isServerInitiatedMethod = (method: string): method is ServerInitiatedMethod =>
    Object.hasOwn(ServerRequestParamsSchemas, method);

const dispatch = async (method: string, params: unknown, ctx: HandlerContext): Promise<unknown> => {
    if (!isServerInitiatedMethod(method)) {
        throw methodNotFoundError(method);
    }

    return HANDLERS[method](ctx, params);
};

export { dispatch, type HandlerContext };

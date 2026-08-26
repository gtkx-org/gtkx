import * as Gtk from "@gtkx/gi/gtk";
import {
    invalidRequestError,
    methodNotFoundError,
    type ParamsSchema,
    type Result,
    type ServerInitiatedMethod,
    type ServerRequestParams,
    ServerRequestParamsSchemas,
    widgetNotFoundError,
} from "@gtkx/mcp/internal";
import type { WidgetRegistry } from "./widget-registry.js";
import { serializeWidget } from "./serialize-widget.js";
import { loadTestingModule, type TestingModule } from "./testing-loader.js";
import { readWidgetProperties } from "./widget-properties.js";

type HandlerContext = {
    app: Gtk.Application;
    registry: WidgetRegistry;
};

type ValidatedHandler = (ctx: HandlerContext, params: unknown) => Promise<Result>;
type WidgetTarget = { testing: TestingModule; widget: Gtk.Widget };
type WidgetParams = { widgetId?: string | undefined };
type TargetedHandler<Params> = (ctx: HandlerContext, target: WidgetTarget, params: Params) => Promise<Result>;
type QueryParams = ServerRequestParams<"widget.query">;
type QueryBy = QueryParams["by"];
type QueryRunner = (testing: TestingModule, app: Gtk.Application, params: QueryParams) => Promise<Gtk.Widget[]>;

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
    "widget.getProps": targeted(
        ServerRequestParamsSchemas["widget.getProps"],
        ({ registry }, { testing, widget }, params) =>
            Promise.resolve({
                ...(params.properties !== undefined && {
                    properties: readWidgetProperties(widget, params.properties, registry),
                }),
                ...serializeWidget(widget, (target) => registry.getOrCreateId(target), testing, params.maxDepth),
            }),
    ),
    "widget.click": targeted(ServerRequestParamsSchemas["widget.click"], async (_ctx, { testing, widget }) => {
        await testing.userEvent.click(widget);

        return { success: true };
    }),
    "widget.type": targeted(ServerRequestParamsSchemas["widget.type"], async (_ctx, { testing, widget }, params) => {
        if (params.clear) {
            await testing.userEvent.clear(widget);
        }

        await testing.userEvent.type(widget, params.text);

        return { success: true };
    }),
    "widget.fireEvent": targeted(
        ServerRequestParamsSchemas["widget.fireEvent"],
        async (_ctx, { testing, widget }, params) => {
            const signalArgs = (params.args ?? []).map((arg) => extractSignalArg(arg));
            const isRealized = widget.getRealized();
            const isMapped = widget.getMapped();
            const isSensitive = widget.getSensitive();
            await testing.fireEvent(widget, params.signal, ...signalArgs);

            return {
                signal: params.signal,
                isRealized,
                isMapped,
                isSensitive,
                note: emissionNote(isRealized, isMapped),
            };
        },
    ),
    "widget.screenshot": validated(ServerRequestParamsSchemas["widget.screenshot"], handleScreenshot),
};

const QUERY_RUNNERS: Record<QueryBy, QueryRunner> = {
    role: runRoleQuery,
    text: runTextQuery,
    name: runNameQuery,
    labelText: runLabelTextQuery,
};

const SEARCHED_BY: Record<QueryBy, string> = {
    role: "the accessible role, narrowed by any options given",
    text: "the text the widget renders",
    name:
        "the widget name (gtk_widget_get_name, which reports the GType name such as \"GtkButton\" when no name " +
        "was set), the accessible label, and the text the widget renders",
    labelText: "the accessible label, the labelled-by relation, and the label whose mnemonic targets the widget",
};

function validated<Params>(
    schema: ParamsSchema<Params>,
    handler: (ctx: HandlerContext, params: Params) => Promise<Result>,
): ValidatedHandler {
    return (ctx, params) => {
        const parsed = schema.safeParse(params ?? {});

        if (!parsed.success) {
            throw invalidRequestError(parsed.error.message);
        }

        return handler(ctx, parsed.data);
    };
}

function targeted<Params extends WidgetParams>(
    schema: ParamsSchema<Params>,
    handler: TargetedHandler<Params>,
): ValidatedHandler {
    return validated(schema, async (ctx, params) =>
        handler(ctx, await widgetTarget(ctx.registry, params.widgetId), params));
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

const emissionNote = (isRealized: boolean, isMapped: boolean): string => {
    if (isRealized && isMapped) {
        return (
            "The signal was emitted. Default handlers that animate, such as a button activate, settle " +
            "asynchronously, so read the widget again rather than assuming the effect has landed."
        );
    }

    return (
        "The signal was emitted on a widget that is not realized and mapped, so a default handler that " +
        "requires a drawn widget does nothing. Present the containing window or open the containing " +
        "popover first, then fire the signal again."
    );
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

function runRoleQuery(testing: TestingModule, app: Gtk.Application, params: QueryParams): Promise<Gtk.Widget[]> {
    const roleValue = resolveRole(params.value);

    if (roleValue === undefined) {
        throw invalidRequestError(
            `Unknown accessible role "${String(params.value)}"; use the lowercase role shown in the ` +
            "widget tree, e.g. \"button\", \"list\", \"list_item\", or \"checkbox\".",
        );
    }

    return matchesOrEmpty(() => testing.findAllByRole(app, roleValue, params.options));
}

function runTextQuery(testing: TestingModule, app: Gtk.Application, params: QueryParams): Promise<Gtk.Widget[]> {
    return matchesOrEmpty(() => testing.findAllByText(app, String(params.value), params.options));
}

function runLabelTextQuery(testing: TestingModule, app: Gtk.Application, params: QueryParams): Promise<Gtk.Widget[]> {
    return matchesOrEmpty(() => testing.findAllByLabelText(app, String(params.value), params.options));
}

async function runNameQuery(
    testing: TestingModule,
    app: Gtk.Application,
    params: QueryParams,
): Promise<Gtk.Widget[]> {
    const matches = await Promise.all([
        matchesOrEmpty(() => testing.findAllByName(app, String(params.value), params.options)),
        runLabelTextQuery(testing, app, params),
        runTextQuery(testing, app, params),
    ]);

    return [...new Set(matches.flat())];
}

const emptyQueryHint = (params: QueryParams): string =>
    `Nothing matched by:"${params.by}" value:"${String(params.value)}", which compared ${SEARCHED_BY[params.by]}. ` +
    "Call gtkx_get_widget_tree to see what is mounted; by:\"name\" is the widest match, and by:\"role\" accepts " +
    "options.name to match the accessible name of a known role.";

async function handleQuery({ app, registry }: HandlerContext, params: QueryParams): Promise<Result> {
    const testing = await loadTestingModule();
    const widgets = await QUERY_RUNNERS[params.by](testing, app, params);
    const resolveId = (widget: Gtk.Widget): string => registry.getOrCreateId(widget);

    return {
        widgets: widgets.map((widget) => serializeWidget(widget, resolveId, testing, 0)),
        searched: SEARCHED_BY[params.by],
        ...(widgets.length === 0 && { hint: emptyQueryHint(params) }),
    };
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
): Promise<Result> {
    const testing = await loadTestingModule();
    const target = params.windowId ? requireWidget(registry, params.windowId) : defaultScreenshotTarget(registry);
    const result = await testing.screenshot(target, { path: params.path });

    if (params.path) {
        return { data: result.data, mimeType: result.mimeType, savedPath: params.path };
    }

    return { data: result.data, mimeType: result.mimeType };
}

const isServerInitiatedMethod = (method: string): method is ServerInitiatedMethod =>
    Object.hasOwn(ServerRequestParamsSchemas, method);

const dispatch = async (method: string, params: unknown, ctx: HandlerContext): Promise<Result> => {
    if (!isServerInitiatedMethod(method)) {
        throw methodNotFoundError(method);
    }

    return HANDLERS[method](ctx, params);
};

export { dispatch };

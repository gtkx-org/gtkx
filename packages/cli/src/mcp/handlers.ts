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
import { errorMessage } from "@gtkx/utils";
import type { WidgetRegistry } from "./widget-registry.js";
import { serializeWidget } from "./serialize-widget.js";
import type { TestingModule } from "./testing-loader.js";
import { readWidgetProperties } from "./widget-properties.js";

type HandlerContext = {
    registry: WidgetRegistry;
    loadTesting: () => Promise<TestingModule>;
    reportUncaughtError: (cause: unknown) => void;
};

type ValidatedHandler = (ctx: HandlerContext, params: unknown) => Promise<Result>;
type WidgetTarget = { testing: TestingModule; widget: Gtk.Widget };
type WidgetParams = { widgetId?: string | undefined };
type TargetedHandler<Params> = (ctx: HandlerContext, target: WidgetTarget, params: Params) => Promise<Result>;
type QueryParams = ServerRequestParams<"widget.query">;
type QueryBy = QueryParams["by"];
type WindowQuery = (root: Gtk.Window) => Gtk.Widget[];
type QueryRunner = (testing: TestingModule, params: QueryParams) => WindowQuery;

const HANDLERS: Record<ServerInitiatedMethod, ValidatedHandler> = {
    "app.getWindows": validated(ServerRequestParamsSchemas["app.getWindows"], ({ registry }) =>
        Promise.resolve({
            windows: registry.toplevels().map((window) => ({
                id: registry.getOrCreateId(window),
                title: window.getTitle(),
            })),
        }),
    ),
    "widget.getTree": validated(
        ServerRequestParamsSchemas["widget.getTree"],
        async ({ registry, loadTesting }, params) => {
            const testing = await loadTesting();
            const roots = params.rootId === undefined ? registry.toplevels() : [requireWidget(registry, params.rootId)];
            const options = {
                getId: (w: Gtk.Widget) => registry.getOrCreateId(w),
                shouldHighlight: false,
                ...(params.maxDepth !== undefined && { maxDepth: params.maxDepth }),
            };

            return { tree: roots.map((root) => testing.prettyWidget(root, options)).join("\n") };
        },
    ),
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
    "widget.click": targeted(ServerRequestParamsSchemas["widget.click"], async (ctx, { testing, widget }) => {
        await interact(ctx, testing, () => testing.userEvent.click(widget));

        return { success: true };
    }),
    "widget.type": targeted(ServerRequestParamsSchemas["widget.type"], async (ctx, { testing, widget }, params) => {
        await interact(ctx, testing, async () => {
            if (params.clear) {
                await testing.userEvent.clear(widget);
            }

            await testing.userEvent.type(widget, params.text.replaceAll("{", "{{"));
        });

        return { success: true };
    }),
    "widget.pressKeys": validated(ServerRequestParamsSchemas["widget.pressKeys"], async (ctx, params) => {
        const testing = await ctx.loadTesting();
        const { registry } = ctx;
        const widget =
            params.widgetId === undefined ? focusedWidget(registry) : requireWidget(registry, params.widgetId);
        await interact(ctx, testing, () => testing.userEvent.keyboard(widget, params.keys));

        return { success: true };
    }),
    "widget.fireEvent": targeted(
        ServerRequestParamsSchemas["widget.fireEvent"],
        async (ctx, { testing, widget }, params) => {
            const signalArgs = (params.args ?? []).map((arg) => extractSignalArg(arg));
            const isRealized = widget.getRealized();
            const isMapped = widget.getMapped();
            const isSensitive = widget.getSensitive();
            await interact(ctx, testing, () => testing.fireEvent(widget, params.signal, ...signalArgs));

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
        'the widget name (gtk_widget_get_name, which reports the GType name such as "GtkButton" when no name ' +
        "was set), the accessible name, the accessible label, and the text the widget renders",
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
    return validated(schema, async (ctx, params) => handler(ctx, await widgetTarget(ctx, params.widgetId), params));
}

const widgetTarget = async (
    { registry, loadTesting }: HandlerContext,
    widgetId: string | undefined,
): Promise<WidgetTarget> => ({
    testing: await loadTesting(),
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

const collectedErrors = (cause: unknown): unknown[] => (cause instanceof AggregateError ? cause.errors : [cause]);

const withPointerTargetId = (registry: WidgetRegistry, testing: TestingModule, cause: unknown): unknown => {
    const target = testing.getPointerTarget(cause);

    if (target === null) {
        return cause;
    }

    return new Error(`${errorMessage(cause)}. Its widget ID is "${registry.getOrCreateId(target)}".`, { cause });
};

const interact = async (ctx: HandlerContext, testing: TestingModule, run: () => Promise<void>): Promise<void> => {
    try {
        await run();
    } catch (cause) {
        if (testing.isUsageError(cause)) {
            throw withPointerTargetId(ctx.registry, testing, cause);
        }

        const errors = collectedErrors(cause);

        for (const error of errors) {
            ctx.reportUncaughtError(error);
        }

        if (!testing.isUncaughtError(cause)) {
            throw cause;
        }

        throw new Error(errors.map((error) => errorMessage(error)).join("\n"), { cause });
    }
};

const focusedWidget = (registry: WidgetRegistry): Gtk.Widget => {
    const toplevels = registry.toplevels();
    const window = toplevels.find((toplevel) => toplevel.isActive()) ?? toplevels[0];

    if (!window) {
        throw new Error("No windows are open to receive the keys");
    }

    return window.getFocus() ?? window;
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

function runRoleQuery(testing: TestingModule, params: QueryParams): WindowQuery {
    const roleValue = resolveRole(params.value);

    if (roleValue === undefined) {
        throw invalidRequestError(
            `Unknown accessible role "${String(params.value)}"; use the lowercase role shown in the ` +
                'widget tree, e.g. "button", "list", "list_item", or "checkbox".',
        );
    }

    return (root) => testing.queryAllByRole(root, roleValue, params.options);
}

function runTextQuery(testing: TestingModule, params: QueryParams): WindowQuery {
    return (root) => testing.queryAllByText(root, String(params.value), params.options);
}

function runLabelTextQuery(testing: TestingModule, params: QueryParams): WindowQuery {
    return (root) => testing.queryAllByLabelText(root, String(params.value), params.options);
}

function runAccessibleNameQuery(testing: TestingModule, params: QueryParams): WindowQuery {
    const options = { ...params.options, name: String(params.value) };

    return (root) => {
        const widgets = [...testing.getRoles(root).values()].flat();
        const roles = new Set(widgets.map((widget) => widget.getAccessibleRole()));
        roles.delete(Gtk.AccessibleRole.LABEL);

        return [...roles].flatMap((role) => testing.queryAllByRole(root, role, options));
    };
}

function runNameQuery(testing: TestingModule, params: QueryParams): WindowQuery {
    const byAccessibleName = runAccessibleNameQuery(testing, params);
    const byLabel = runLabelTextQuery(testing, params);
    const byText = runTextQuery(testing, params);

    return (root) => [
        ...testing.queryAllByName(root, String(params.value), params.options),
        ...byAccessibleName(root),
        ...byLabel(root),
        ...byText(root),
    ];
}

const emptyQueryHint = (params: QueryParams): string =>
    `Nothing matched by:"${params.by}" value:"${String(params.value)}", which compared ${SEARCHED_BY[params.by]}. ` +
    'Call gtkx_get_widget_tree to see what is mounted; by:"name" is the widest match, and by:"role" accepts ' +
    "options.name to match the accessible name of a known role.";

async function handleQuery({ registry, loadTesting }: HandlerContext, params: QueryParams): Promise<Result> {
    const testing = await loadTesting();
    const query = QUERY_RUNNERS[params.by](testing, params);
    const matchToplevels = (): Gtk.Widget[] => {
        const matches = new Set(registry.toplevels().flatMap(query));

        if (matches.size === 0) {
            throw new Error(emptyQueryHint(params));
        }

        return [...matches];
    };
    const widgets = await testing.waitFor(matchToplevels).catch((): Gtk.Widget[] => []);
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
    { registry, loadTesting }: HandlerContext,
    params: ServerRequestParams<"widget.screenshot">,
): Promise<Result> {
    const testing = await loadTesting();
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

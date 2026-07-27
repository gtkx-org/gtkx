import { ErrorCode, ProtocolError } from "@gtkx/mcp/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatch } from "../../src/mcp/handlers.js";
import { WidgetRegistry } from "../../src/mcp/widget-registry.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./fake-widget.js";

type PrettyWidgetOptions = { getId?: (widget: unknown) => string; highlight?: boolean; maxDepth?: number };

type FakeApp = {
    getWindows: () => { getTitle?: () => string | null }[];
};

type TextMatches = { widgets: { text: string | null }[] };
type ChildMatches = { widgets: { children: unknown[] }[] };

const hoisted = vi.hoisted(() => ({
    findAllByRole: vi.fn(),
    findAllByText: vi.fn(),
    findAllByName: vi.fn(),
    findAllByLabelText: vi.fn(),
    screenshot: vi.fn(),
    click: vi.fn(() => Promise.resolve()),
    typeText: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    fireEvent: vi.fn(() => Promise.resolve()),
    prettyWidget: vi.fn<(container: unknown, options?: PrettyWidgetOptions) => string>(() => "tree"),
    formatRole: vi.fn((role: number) => (role === 2 ? "label" : "button")),
    getWidgetNodeText: vi.fn((widget: { getLabel?: () => string | null; getText?: () => string | null }) => {
        return widget.getLabel?.() ?? widget.getText?.() ?? null;
    }),
    listToplevels: vi.fn(() => [] as unknown[]),
    AccessibleRole: { BUTTON: 1, LABEL: 2 },
}));

const {
    findAllByRole,
    findAllByText,
    findAllByName,
    findAllByLabelText,
    screenshot,
    click,
    typeText,
    clear,
    fireEvent,
    prettyWidget,
    listToplevels,
} = hoisted;

const makeApp = (windows: { getTitle?: () => string | null }[] = []): FakeApp => ({
    getWindows: () => windows,
});

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget(overrides);

const registerWidget = (registry: WidgetRegistry, widget: never): string => {
    registry.register(widget);

    return registry.getOrCreateId(widget);
};

const dispatchQuery = (params: Record<string, unknown>, registry = new WidgetRegistry()): Promise<unknown> =>
    dispatch("widget.query", params, { app: makeApp() as never, registry });

vi.mock("@gtkx/testing", () => ({
    findAllByRole: hoisted.findAllByRole,
    findAllByText: hoisted.findAllByText,
    findAllByName: hoisted.findAllByName,
    findAllByLabelText: hoisted.findAllByLabelText,
    screenshot: hoisted.screenshot,
    fireEvent: hoisted.fireEvent,
    prettyWidget: hoisted.prettyWidget,
    formatRole: hoisted.formatRole,
    getWidgetNodeText: hoisted.getWidgetNodeText,
    userEvent: { click: hoisted.click, type: hoisted.typeText, clear: hoisted.clear },
}));

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: hoisted.AccessibleRole,
    Window: { listToplevels: hoisted.listToplevels },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("dispatch (method routing)", () => {
    it("throws methodNotFoundError for unknown methods", async () => {
        const registry = new WidgetRegistry();
        const app = makeApp();

        await expect(dispatch("widget.unknown", {}, { app: app as never, registry })).rejects.toMatchObject({
            code: ErrorCode.METHOD_NOT_FOUND,
        });
    });
});

describe("app.getWindows", () => {
    it("returns toplevel ids and titles from the registry's captured set", async () => {
        const w1 = makeWidget({ getTitle: () => "Hello" });
        const w2 = makeWidget({ getTitle: () => null });
        listToplevels.mockReturnValueOnce([w1, w2]);
        const registry = new WidgetRegistry();
        registry.refresh();

        const result = (await dispatch("app.getWindows", {}, { app: makeApp() as never, registry })) as {
            windows: { id: string; title: string | null }[];
        };

        expect(result.windows).toHaveLength(2);
        expect(result.windows[0]?.title).toBe("Hello");
        expect(result.windows[1]?.title).toBeNull();
    });
});

describe("widget.getTree", () => {
    it("returns the testing module's pretty-printed tree", async () => {
        prettyWidget.mockReturnValueOnce("rendered");
        const registry = new WidgetRegistry();

        const result = (await dispatch("widget.getTree", {}, { app: makeApp() as never, registry })) as {
            tree: string;
        };

        expect(result.tree).toBe("rendered");
        const [container, options] = prettyWidget.mock.calls[0] ?? [];
        expect(container).toBeDefined();
        expect(options?.getId).toBeTypeOf("function");
        expect(options?.highlight).toBe(false);
    });

    it("resolves tree ids through the registry", async () => {
        prettyWidget.mockReturnValueOnce("rendered");
        const registry = new WidgetRegistry();
        const widget = makeWidget({});
        await dispatch("widget.getTree", {}, { app: makeApp() as never, registry });
        const getId = prettyWidget.mock.calls[0]?.[1]?.getId;
        expect(getId?.(widget)).toBe(registry.getOrCreateId(widget));
    });

    it("renders only the subtree for a rootId", async () => {
        prettyWidget.mockReturnValueOnce("subtree");
        const registry = new WidgetRegistry();
        const widget = makeWidget({});
        const rootId = registerWidget(registry, widget);
        await dispatch("widget.getTree", { rootId }, { app: makeApp() as never, registry });
        expect(prettyWidget).toHaveBeenCalledWith(widget, expect.objectContaining({ highlight: false }));
    });

    it("passes maxDepth through to the renderer", async () => {
        prettyWidget.mockReturnValueOnce("shallow");
        const registry = new WidgetRegistry();
        await dispatch("widget.getTree", { maxDepth: 2 }, { app: makeApp() as never, registry });
        expect(prettyWidget).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ maxDepth: 2 }));
    });
});

describe("widget.query", () => {
    it("converts a string role into the enum value before delegating to findAllByRole", async () => {
        const widget = makeWidget({ getLabel: () => "OK" });
        findAllByRole.mockResolvedValueOnce([widget]);
        const result = (await dispatchQuery({ by: "role", value: "BUTTON", options: { exact: true } })) as TextMatches;
        expect(findAllByRole).toHaveBeenCalledWith(expect.anything(), 1, { exact: true });
        expect(result.widgets[0]?.text).toBe("OK");
    });

    it("accepts the lowercase role shown in the widget tree", async () => {
        findAllByRole.mockResolvedValueOnce([makeWidget()]);
        await dispatchQuery({ by: "role", value: "button" });
        expect(findAllByRole).toHaveBeenCalledWith(expect.anything(), 1, undefined);
    });

    it("rejects an unknown role with a clear error instead of delegating", async () => {
        await expect(dispatchQuery({ by: "role", value: "nonsense" })).rejects.toMatchObject({
            code: ErrorCode.INVALID_REQUEST,
        });

        expect(findAllByRole).not.toHaveBeenCalled();
    });

    it("routes text/name/labelText through the matching testing helper", async () => {
        const widget = makeWidget();
        findAllByText.mockResolvedValueOnce([widget]);
        findAllByName.mockResolvedValueOnce([widget]);
        findAllByLabelText.mockResolvedValueOnce([widget]);
        const registry = new WidgetRegistry();
        await dispatchQuery({ by: "text", value: "Hi" }, registry);
        await dispatchQuery({ by: "name", value: "btn" }, registry);
        await dispatchQuery({ by: "labelText", value: "Submit" }, registry);
        expect(findAllByText).toHaveBeenCalledWith(expect.anything(), "Hi", undefined);
        expect(findAllByName).toHaveBeenCalledWith(expect.anything(), "btn", undefined);
        expect(findAllByLabelText).toHaveBeenCalledWith(expect.anything(), "Submit", undefined);
    });

    it("returns shallow match summaries without descendants", async () => {
        findAllByRole.mockResolvedValueOnce([makeWidget({ getFirstChild: () => makeWidget({}) })]);
        const result = (await dispatchQuery({ by: "role", value: "button" })) as ChildMatches;
        expect(result.widgets[0]?.children).toEqual([]);
    });

    it("returns an empty match list instead of throwing when nothing is found", async () => {
        findAllByRole.mockRejectedValueOnce(new Error("Unable to find an element with the role"));
        const result = (await dispatchQuery({ by: "role", value: "button" })) as { widgets: unknown[] };
        expect(result.widgets).toEqual([]);
    });

    it("rejects an unknown query type at the wire-schema boundary", async () => {
        await expect(dispatchQuery({ by: "id", value: "x" })).rejects.toMatchObject({
            code: ErrorCode.INVALID_REQUEST,
        });
    });
});

describe("widget.getProps", () => {
    it("returns the serialized widget when the id is known", async () => {
        const widget = makeWidget({ getName: () => "ok" });
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, widget);

        const result = (await dispatch("widget.getProps", { widgetId: id }, { app: makeApp() as never, registry })) as {
            name: string | null;
        };

        expect(result.name).toBe("ok");
    });

    it("throws widgetNotFoundError when the id is unknown", async () => {
        const registry = new WidgetRegistry();

        await expect(
            dispatch("widget.getProps", { widgetId: "missing" }, { app: makeApp() as never, registry }),
        ).rejects.toMatchObject({ code: ErrorCode.WIDGET_NOT_FOUND });
    });

    it("throws widgetNotFoundError when no widgetId is supplied", async () => {
        const registry = new WidgetRegistry();

        await expect(dispatch("widget.getProps", {}, { app: makeApp() as never, registry })).rejects.toBeInstanceOf(
            ProtocolError,
        );
    });
});

describe("widget.click / widget.type / widget.fireEvent", () => {
    it("clicks the resolved widget and reports success", async () => {
        const widget = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, widget);
        const result = await dispatch("widget.click", { widgetId: id }, { app: makeApp() as never, registry });
        expect(click).toHaveBeenCalledWith(widget);
        expect(result).toEqual({ success: true });
    });

    it("clears before typing when clear=true", async () => {
        const widget = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, widget);
        await dispatch("widget.type", { widgetId: id, text: "hi", clear: true }, { app: makeApp() as never, registry });
        expect(clear).toHaveBeenCalledWith(widget);
        expect(typeText).toHaveBeenCalledWith(widget, "hi");
    });

    it("unwraps typed signal args before firing", async () => {
        const widget = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, widget);

        await dispatch(
            "widget.fireEvent",
            { widgetId: id, signal: "clicked", args: [{ type: "int", value: 42 }, "plain"] },
            { app: makeApp() as never, registry },
        );

        expect(fireEvent).toHaveBeenCalledWith(widget, "clicked", 42, "plain");
    });
});

describe("widget.screenshot", () => {
    it("screenshots the first toplevel when no windowId is supplied", async () => {
        const window = makeWidget({ getTitle: () => "win" });
        listToplevels.mockReturnValueOnce([window]);
        screenshot.mockResolvedValueOnce({ data: "abc", mimeType: "image/png" });
        const registry = new WidgetRegistry();
        registry.refresh();

        const result = (await dispatch("widget.screenshot", {}, { app: makeApp() as never, registry })) as {
            data: string;
            mimeType: string;
        };

        expect(result).toEqual({ data: "abc", mimeType: "image/png" });
        expect(screenshot).toHaveBeenCalledWith(window);
    });

    it("screenshots the named window when windowId is supplied", async () => {
        const window = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, window);
        screenshot.mockResolvedValueOnce({ data: "x", mimeType: "image/png" });
        await dispatch("widget.screenshot", { windowId: id }, { app: makeApp() as never, registry });
        expect(screenshot).toHaveBeenCalledWith(window);
    });

    it("throws when no windows are available and no windowId is supplied", async () => {
        const registry = new WidgetRegistry();

        await expect(dispatch("widget.screenshot", {}, { app: makeApp() as never, registry })).rejects.toThrow(
            /No windows available/,
        );
    });
});

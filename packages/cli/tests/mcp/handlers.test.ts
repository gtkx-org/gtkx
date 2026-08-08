import { ErrorCode, ProtocolError } from "@gtkx/mcp/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatch } from "../../src/mcp/handlers.js";
import { WidgetRegistry } from "../../src/mcp/widget-registry.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./fake-widget.js";

type PrettyWidgetOptions = { getId?: (widget: unknown) => string; shouldHighlight?: boolean; maxDepth?: number };

type FakeApp = {
    getWindows: () => { getTitle?: () => string | null }[];
};

type TextMatches = { widgets: { text: string | null }[] };
type ChildMatches = { widgets: { children: unknown[] }[] };

type WidgetTarget = {
    widget: never;
    dispatchWidget: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

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
    getWidgetText: vi.fn((widget: { getLabel?: () => string | null; getText?: () => string | null }) => {
        return widget.getLabel?.() ?? widget.getText?.() ?? null;
    }),
    listToplevels: vi.fn(() => [] as unknown[]),
    act: vi.fn((callback: () => unknown) => Promise.resolve(callback())),
    AccessibleRole: { BUTTON: 1, LABEL: 2 },
    TreeExpander: class TreeExpander {
        isTreeExpander = true;
    },
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

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => {
    const widget = makeFakeWidget(overrides);

    return overrides.type === "GtkTreeExpander" ? Object.assign(new hoisted.TreeExpander(), widget) : widget;
};

const registerWidget = (registry: WidgetRegistry, widget: never): string => {
    registry.register(widget);

    return registry.getOrCreateId(widget);
};

const dispatchQuery = (params: Record<string, unknown>, registry = new WidgetRegistry()): Promise<unknown> =>
    dispatch("widget.query", params, { app: makeApp() as never, registry });

const dispatchMatchingNameQuery = (value: string): Promise<unknown> => {
    findAllByName.mockResolvedValueOnce([makeWidget()]);

    return dispatchQuery({ by: "name", value });
};

const makeWidgetTarget = (overrides: FakeWidgetOverrides = {}): WidgetTarget => {
    const widget = makeWidget(overrides);
    const registry = new WidgetRegistry();
    const id = registerWidget(registry, widget);

    return {
        widget,
        dispatchWidget: (method, params) =>
            dispatch(method, { widgetId: id, ...params }, { app: makeApp() as never, registry }),
    };
};

vi.mock("@gtkx/testing", () => ({
    act: hoisted.act,
    findAllByRole: hoisted.findAllByRole,
    findAllByText: hoisted.findAllByText,
    findAllByName: hoisted.findAllByName,
    findAllByLabelText: hoisted.findAllByLabelText,
    screenshot: hoisted.screenshot,
    fireEvent: hoisted.fireEvent,
    prettyWidget: hoisted.prettyWidget,
    formatRole: hoisted.formatRole,
    getWidgetText: hoisted.getWidgetText,
    userEvent: { click: hoisted.click, type: hoisted.typeText, clear: hoisted.clear },
}));

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: hoisted.AccessibleRole,
    TreeExpander: hoisted.TreeExpander,
    Window: { listToplevels: hoisted.listToplevels },
}));

beforeEach(() => {
    vi.clearAllMocks();
    findAllByRole.mockResolvedValue([]);
    findAllByText.mockResolvedValue([]);
    findAllByName.mockResolvedValue([]);
    findAllByLabelText.mockResolvedValue([]);
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
        expect(options?.shouldHighlight).toBe(false);
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
        expect(prettyWidget).toHaveBeenCalledWith(widget, expect.objectContaining({ shouldHighlight: false }));
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

    it("routes text and labelText through the matching testing helper", async () => {
        const widget = makeWidget();
        const registry = new WidgetRegistry();
        findAllByText.mockResolvedValueOnce([widget]);
        await dispatchQuery({ by: "text", value: "Hi" }, registry);
        findAllByLabelText.mockResolvedValueOnce([widget]);
        await dispatchQuery({ by: "labelText", value: "Submit" }, registry);
        expect(findAllByText).toHaveBeenCalledWith(expect.anything(), "Hi", undefined);
        expect(findAllByLabelText).toHaveBeenCalledWith(expect.anything(), "Submit", undefined);
        expect(findAllByName).not.toHaveBeenCalled();
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

describe("widget.query by name", () => {
    it("finds a widget by its accessible label when no widget name matches", async () => {
        const row = makeWidget({ getLabel: () => "Name", type: "AdwEntryRow" });
        findAllByLabelText.mockResolvedValueOnce([row]);
        const result = (await dispatchQuery({ by: "name", value: "Name" })) as TextMatches;
        expect(result.widgets).toHaveLength(1);
        expect(result.widgets[0]?.text).toBe("Name");
    });

    it("finds a widget by its rendered text when no widget name matches", async () => {
        findAllByText.mockResolvedValueOnce([makeWidget({ getLabel: () => "Save" })]);
        const result = (await dispatchQuery({ by: "name", value: "Save" })) as TextMatches;
        expect(result.widgets[0]?.text).toBe("Save");
    });

    it("compares the widget name, the accessible label, and the rendered text", async () => {
        await dispatchQuery({ by: "name", value: "Name" });
        expect(findAllByName).toHaveBeenCalledWith(expect.anything(), "Name", undefined);
        expect(findAllByLabelText).toHaveBeenCalledWith(expect.anything(), "Name", undefined);
        expect(findAllByText).toHaveBeenCalledWith(expect.anything(), "Name", undefined);
    });

    it("returns a widget once when several lookups match it", async () => {
        const widget = makeWidget();
        findAllByName.mockResolvedValueOnce([widget]);
        findAllByLabelText.mockResolvedValueOnce([widget]);
        findAllByText.mockResolvedValueOnce([widget]);
        const result = (await dispatchQuery({ by: "name", value: "dup" })) as { widgets: unknown[] };
        expect(result.widgets).toHaveLength(1);
    });
});

describe("widget.query result description", () => {
    it("spells out that the name query covers the GType fallback and the accessible label", async () => {
        const result = (await dispatchMatchingNameQuery("GtkButton")) as { searched: string };
        expect(result.searched).toContain("gtk_widget_get_name");
        expect(result.searched).toContain("accessible label");
    });

    it("describes what a role query compared", async () => {
        findAllByRole.mockResolvedValueOnce([makeWidget()]);
        const result = (await dispatchQuery({ by: "role", value: "button" })) as { searched: string };
        expect(result.searched).toContain("accessible role");
    });

    it("hints at what was compared when nothing matched", async () => {
        const result = (await dispatchQuery({ by: "name", value: "Missing" })) as { hint: string };
        expect(result.hint).toContain("Nothing matched by:\"name\" value:\"Missing\"");
        expect(result.hint).toContain("gtk_widget_get_name");
        expect(result.hint).toContain("gtkx_get_widget_tree");
    });

    it("omits the hint when the query matched", async () => {
        const result = (await dispatchMatchingNameQuery("hit")) as { hint?: string };
        expect(result.hint).toBeUndefined();
    });
});

describe("widget.getProps", () => {
    it("returns the serialized widget when the id is known", async () => {
        const { dispatchWidget } = makeWidgetTarget({ getName: () => "ok" });
        const result = (await dispatchWidget("widget.getProps", {})) as { name: string | null };
        expect(result.name).toBe("ok");
    });

    it("names the widget type and the property when the widget has no such property", async () => {
        const { dispatchWidget } = makeWidgetTarget();
        const failure = dispatchWidget("widget.getProps", { properties: ["collapsed"] });
        await expect(failure).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
        await expect(failure).rejects.toThrow("GtkWidget has no readable property 'collapsed'");
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
        const { widget, dispatchWidget } = makeWidgetTarget();
        const result = await dispatchWidget("widget.click", {});
        expect(click).toHaveBeenCalledWith(widget);
        expect(result).toEqual({ success: true });
    });

    it("toggles a tree expander through its own action instead of clicking the enclosing row", async () => {
        const activateAction = vi.fn(() => true);
        const { dispatchWidget } = makeWidgetTarget({ type: "GtkTreeExpander", activateAction });
        const result = await dispatchWidget("widget.click", {});
        expect(activateAction).toHaveBeenCalledWith("listitem.toggle-expand", null);
        expect(click).not.toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });

    it("toggles a tree expander inside the act environment so React sees the new rows", async () => {
        const { dispatchWidget } = makeWidgetTarget({ type: "GtkTreeExpander", activateAction: () => true });
        await dispatchWidget("widget.click", {});
        expect(hoisted.act).toHaveBeenCalledTimes(1);
    });

    it("clears before typing when clear=true", async () => {
        const { widget, dispatchWidget } = makeWidgetTarget();
        await dispatchWidget("widget.type", { text: "hi", clear: true });
        expect(clear).toHaveBeenCalledWith(widget);
        expect(typeText).toHaveBeenCalledWith(widget, "hi");
    });

    it("unwraps typed signal args before firing", async () => {
        const { widget, dispatchWidget } = makeWidgetTarget();
        const args = [{ type: "int", value: 42 }, "plain"];
        await dispatchWidget("widget.fireEvent", { signal: "clicked", args });
        expect(fireEvent).toHaveBeenCalledWith(widget, "clicked", 42, "plain");
    });

    it("reports the state of a widget that can act on the signal", async () => {
        const { dispatchWidget } = makeWidgetTarget();
        const result = await dispatchWidget("widget.fireEvent", { signal: "clicked" });
        expect(result).toMatchObject({ signal: "clicked", isRealized: true, isMapped: true, isSensitive: true });
    });

    it("reports that an unrealized widget could not act on the signal", async () => {
        const { dispatchWidget } = makeWidgetTarget({ getRealized: () => false, getMapped: () => false });
        const result = await dispatchWidget("widget.fireEvent", { signal: "activate" });
        expect(result).toMatchObject({ isRealized: false, isMapped: false });
        expect((result as { note: string }).note).toContain("not realized and mapped");
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
        expect(screenshot).toHaveBeenCalledWith(window, { path: undefined });
    });

    it("screenshots the named window when windowId is supplied", async () => {
        const window = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, window);
        screenshot.mockResolvedValueOnce({ data: "x", mimeType: "image/png" });
        await dispatch("widget.screenshot", { windowId: id }, { app: makeApp() as never, registry });
        expect(screenshot).toHaveBeenCalledWith(window, { path: undefined });
    });

    it("forwards the output path and reports where the capture was saved", async () => {
        const window = makeWidget();
        const registry = new WidgetRegistry();
        const id = registerWidget(registry, window);
        screenshot.mockResolvedValueOnce({ data: "y", mimeType: "image/png" });

        const result = await dispatch(
            "widget.screenshot",
            { windowId: id, path: "/screenshots/gtkx/shot.png" },
            { app: makeApp() as never, registry },
        );

        expect(screenshot).toHaveBeenCalledWith(window, { path: "/screenshots/gtkx/shot.png" });
        expect(result).toEqual({ data: "y", mimeType: "image/png", savedPath: "/screenshots/gtkx/shot.png" });
    });

    it("throws when no windows are available and no windowId is supplied", async () => {
        const registry = new WidgetRegistry();

        await expect(dispatch("widget.screenshot", {}, { app: makeApp() as never, registry })).rejects.toThrow(
            /No windows available/,
        );
    });
});

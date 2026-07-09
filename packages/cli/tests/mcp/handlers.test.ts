import { ErrorCode, ProtocolError } from "@gtkx/mcp/internal";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    findAllByRole: vi.fn(),
    findAllByText: vi.fn(),
    findAllByName: vi.fn(),
    findAllByLabelText: vi.fn(),
    screenshot: vi.fn(),
    click: vi.fn(async () => undefined),
    typeText: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    fireEvent: vi.fn(async () => undefined),
    prettyWidget: vi.fn((_container: unknown, _options?: { getId?: (w: unknown) => string }) => "tree"),
    formatRole: vi.fn((role: number) => (role === 2 ? "label" : "button")),
    getWidgetNodeText: vi.fn((widget: { getLabel?: () => string | null; getText?: () => string | null }) => {
        return widget.getLabel?.() ?? widget.getText?.() ?? null;
    }),
    listToplevels: vi.fn(() => [] as unknown[]),
    AccessibleRole: { BUTTON: 1, LABEL: 2 } as Record<string, number>,
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

import { dispatch } from "../../src/mcp/handlers.js";
import { WidgetRegistry } from "../../src/mcp/widget-registry.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./fake-widget.js";

type FakeApp = {
    getWindows: () => Array<{ getTitle?: () => string | null }>;
};

const makeApp = (windows: Array<{ getTitle?: () => string | null }> = []): FakeApp => ({
    getWindows: () => windows,
});

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget(overrides);

const registerWidget = (registry: WidgetRegistry, widget: never): string => {
    registry.register(widget);
    return registry.idFor(widget);
};

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
            windows: Array<{ id: string; title: string | null }>;
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
        expect(prettyWidget).toHaveBeenCalledWith(expect.anything(), {
            getId: expect.any(Function),
            highlight: false,
        });
    });

    it("resolves tree ids through the registry", async () => {
        prettyWidget.mockReturnValueOnce("rendered");
        const registry = new WidgetRegistry();
        const widget = makeWidget({});

        await dispatch("widget.getTree", {}, { app: makeApp() as never, registry });

        const getId = prettyWidget.mock.calls[0]?.[1]?.getId;
        expect(getId?.(widget)).toBe(registry.idFor(widget));
    });
});

describe("widget.query", () => {
    it("converts a string role into the enum value before delegating to findAllByRole", async () => {
        const widget = makeWidget({ getLabel: () => "OK" });
        findAllByRole.mockResolvedValueOnce([widget]);
        const registry = new WidgetRegistry();

        const result = (await dispatch(
            "widget.query",
            { by: "role", value: "BUTTON", options: { exact: true } },
            { app: makeApp() as never, registry },
        )) as { widgets: Array<{ text: string | null }> };

        expect(findAllByRole).toHaveBeenCalledWith(expect.anything(), 1, { exact: true });
        expect(result.widgets[0]?.text).toBe("OK");
    });

    it("routes text/name/labelText through the matching testing helper", async () => {
        const widget = makeWidget();
        findAllByText.mockResolvedValueOnce([widget]);
        findAllByName.mockResolvedValueOnce([widget]);
        findAllByLabelText.mockResolvedValueOnce([widget]);
        const registry = new WidgetRegistry();
        const ctx = { app: makeApp() as never, registry };

        await dispatch("widget.query", { by: "text", value: "Hi" }, ctx);
        await dispatch("widget.query", { by: "name", value: "btn" }, ctx);
        await dispatch("widget.query", { by: "labelText", value: "Submit" }, ctx);

        expect(findAllByText).toHaveBeenCalledWith(expect.anything(), "Hi", undefined);
        expect(findAllByName).toHaveBeenCalledWith(expect.anything(), "btn", undefined);
        expect(findAllByLabelText).toHaveBeenCalledWith(expect.anything(), "Submit", undefined);
    });

    it("rejects an unknown query type at the wire-schema boundary", async () => {
        const registry = new WidgetRegistry();
        await expect(
            dispatch("widget.query", { by: "id", value: "x" }, { app: makeApp() as never, registry }),
        ).rejects.toMatchObject({ code: ErrorCode.INVALID_REQUEST });
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

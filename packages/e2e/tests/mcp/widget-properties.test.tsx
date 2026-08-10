import type { WidgetRegistry } from "@gtkx/cli/internal";
import type { SerializedProperty, SerializedWidget } from "@gtkx/mcp/internal";
import type { ReactNode, RefObject } from "react";
import { dispatch } from "@gtkx/cli/internal";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwBreakpoint,
    AdwNavigationPage,
    AdwNavigationSplitView,
} from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { DEFAULT_SUBTREE_DEPTH, ErrorCode, MAX_SUBTREE_WIDGETS, ProtocolError } from "@gtkx/mcp/internal";
import { rootElement } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { kebabCase } from "@gtkx/utils";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";
import { contextFor } from "./dispatch-context.js";

type WidgetProps = SerializedWidget & { properties?: Record<string, SerializedProperty> };
type ReadOptions = { properties?: string[]; maxDepth?: number };
type Probe = { registry: WidgetRegistry; read: (options?: ReadOptions) => Promise<WidgetProps> };

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.mcpprops");
const WIDE_CONDITION = "max-width: 100000px";
const PAYLOAD_LIMIT = 6000;
const CHAIN_DEPTH = 10;
const WIDE_CHILDREN = 60;
const DEEP_TEXT = "Deep";
const SIBLING_TEXT = "Sibling";
const OWN_CONTENT = "Own content";

const renderAdw = (element: ReactNode) =>
    render(
        <AdwApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
            {element}
        </AdwApplication>,
        { container: rootElement },
    );

const getWidget = <T extends Gtk.Widget>(ref: RefObject<T | null>): T => {
    if (ref.current === null) {
        throw new Error("Expected the widget to be rendered");
    }

    return ref.current;
};

const probeFor = (widget: Gtk.Widget): Probe => {
    const context = contextFor(widget);
    const widgetId = context.registry.getOrCreateId(widget);

    return {
        registry: context.registry,
        read: async (options = {}) =>
            await dispatch("widget.getProps", { widgetId, ...options }, context) as WidgetProps,
    };
};

const getDescendant = (node: SerializedWidget, depth: number): SerializedWidget => {
    let current = node;

    for (let level = 0; level < depth; level += 1) {
        const [child] = current.children;

        if (child === undefined) {
            throw new Error(`Expected a descendant ${String(depth)} levels below ${node.type}`);
        }

        current = child;
    }

    return current;
};

const getHint = (error: unknown): string => {
    if (!(error instanceof ProtocolError)) {
        throw new Error(`Expected a ProtocolError, got ${String(error)}`);
    }

    const data = error.data;

    return typeof data === "object" && data !== null && "hint" in data ? String(data.hint) : "";
};

const getFailure = async (read: Promise<unknown>): Promise<unknown> => {
    try {
        await read;
    } catch (error) {
        return error;
    }

    throw new Error("Expected the read to fail");
};

const readProperty = async (widget: Gtk.Widget, name: string): Promise<SerializedProperty> => {
    const result = await probeFor(widget).read({ properties: [name] });
    const property = result.properties?.[kebabCase(name)];

    if (property === undefined) {
        throw new Error(`Expected property "${name}" in ${JSON.stringify(result.properties)}`);
    }

    return property;
};

const probeForLabel = async (text: string): Promise<Probe> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref}>{text}</GtkLabel>);

    return probeFor(getWidget(ref));
};

const countNodes = (node: SerializedWidget): number =>
    node.children.reduce((total, child) => total + countNodes(child), 1);

const manyLabels = (count: number): ReactNode[] =>
    Array.from({ length: count }, (_unused, index) => <GtkLabel key={index}>{`Item ${String(index)}`}</GtkLabel>);

const nestedBoxes = (levels: number): ReactNode =>
    levels <= 1 ? <GtkLabel>{DEEP_TEXT}</GtkLabel> : <GtkBox>{nestedBoxes(levels - 1)}</GtkBox>;

const readBox = async (content: ReactNode, options?: ReadOptions): Promise<WidgetProps> => {
    const ref = createRef<Gtk.Box>();
    await render(<GtkBox ref={ref}>{content}</GtkBox>);

    return await probeFor(getWidget(ref)).read(options);
};

const readChain = (options?: ReadOptions): Promise<WidgetProps> => readBox(nestedBoxes(CHAIN_DEPTH), options);

const readWide = (options?: ReadOptions): Promise<WidgetProps> =>
    readBox(manyLabels(WIDE_CHILDREN), options);

const readBranches = (): Promise<WidgetProps> =>
    readBox(
        <>
            <GtkBox>{manyLabels(WIDE_CHILDREN)}</GtkBox>
            <GtkLabel>{SIBLING_TEXT}</GtkLabel>
        </>,
    );

const readWindow = async (content: ReactNode, options?: ReadOptions): Promise<WidgetProps> => {
    const ref = createRef<Adw.ApplicationWindow>();

    await renderAdw(
        <AdwApplicationWindow ref={ref} title="Payload">
            {content}
        </AdwApplicationWindow>,
    );

    return await probeFor(getWidget(ref)).read(options);
};

const readDeepWindow = (options?: ReadOptions): Promise<WidgetProps> =>
    readWindow(
        <AdwNavigationSplitView>
            <AdwNavigationPage tag="content" title="Content">
                <GtkBox>
                    {manyLabels(WIDE_CHILDREN)}
                    {nestedBoxes(CHAIN_DEPTH)}
                </GtkBox>
            </AdwNavigationPage>
        </AdwNavigationSplitView>,
        options,
    );

const readCollapsed = async (isCollapsed: boolean): Promise<SerializedProperty> => {
    const viewRef = createRef<Adw.NavigationSplitView>();

    await renderAdw(
        <AdwApplicationWindow>
            <AdwNavigationSplitView ref={viewRef} collapsed={isCollapsed}>
                <AdwNavigationPage tag="content" title="Content">
                    <GtkLabel>Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        </AdwApplicationWindow>,
    );

    return await readProperty(getWidget(viewRef), "collapsed");
};

describe("widget.getProps summary", () => {
    it("returns the fixed summary alone when no properties are asked for", async () => {
        const probe = await probeForLabel("Summary");
        const result = await probe.read();
        expect(result.text).toBe("Summary");
        expect(result.role).toBe("label");
        expect(result.properties).toBeUndefined();
    });

    it("keeps the summary alongside the properties that were asked for", async () => {
        const probe = await probeForLabel("Both");
        const result = await probe.read({ properties: ["label"] });
        expect(result.text).toBe("Both");
        expect(result.children).toEqual([]);
        expect(result.properties?.label).toEqual({ type: "gchararray", value: "Both" });
    });
});

describe("widget.getProps property values", () => {
    it("reads a string property", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref}>Hello</GtkLabel>);
        expect(await readProperty(getWidget(ref), "label")).toEqual({ type: "gchararray", value: "Hello" });
    });

    it("reads a boolean property under either spelling", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} useMarkup={true}>Marked</GtkLabel>);
        const kebab = await readProperty(getWidget(ref), "use-markup");
        const camel = await readProperty(getWidget(ref), "useMarkup");
        expect(kebab).toEqual({ type: "gboolean", value: true });
        expect(camel).toEqual(kebab);
    });

    it("reads an enum property as its value name", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);

        expect(await readProperty(getWidget(ref), "orientation")).toEqual({
            type: "GtkOrientation",
            value: "GTK_ORIENTATION_VERTICAL",
        });
    });

    it("reads a flags property as its value names", async () => {
        const ref = createRef<Gtk.Entry>();
        const hintValue = Gtk.InputHints.SPELLCHECK | Gtk.InputHints.LOWERCASE;
        await render(<GtkEntry ref={ref} inputHints={hintValue} />);
        const hints = await readProperty(getWidget(ref), "input-hints");
        expect(hints.type).toBe("GtkInputHints");
        expect(String(hints.value)).toContain("GTK_INPUT_HINT_SPELLCHECK");
        expect(String(hints.value)).toContain("GTK_INPUT_HINT_LOWERCASE");
    });
});

describe("widget.getProps array and object property values", () => {
    it("reads a string array property", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} cssClasses={["dim-label", "heading"]}>Classy</GtkLabel>);

        expect(await readProperty(getWidget(ref), "css-classes")).toEqual({
            type: "GStrv",
            value: ["dim-label", "heading"],
        });
    });

    it("reads a widget-valued property as its type and a resolvable widget id", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkLabel ref={labelRef}>Child</GtkLabel>
            </GtkBox>,
        );

        const probe = probeFor(getWidget(labelRef));
        const result = await probe.read({ properties: ["parent"] });
        const parent = result.properties?.parent;
        expect(parent?.type).toBe("GtkWidget");
        expect(parent?.value).toBe("GtkBox");
        expect(probe.registry.get(parent?.widgetId ?? "")).toBe(getWidget(boxRef));
    });
});

describe("widget.getProps on an unknown property", () => {
    it("names the widget type and the property", async () => {
        const probe = await probeForLabel("Nope");
        const failure = probe.read({ properties: ["collapsed"] });
        await expect(failure).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
        await expect(failure).rejects.toThrow(/GtkLabel has no readable property 'collapsed'/);
    });

    it("lists the readable properties as a hint", async () => {
        const probe = await probeForLabel("Nope");
        const failure = await getFailure(probe.read({ properties: ["collapsed"] }));
        expect(getHint(failure)).toContain("use-markup");
    });
});

describe("widget.getProps on adaptive Adwaita widgets", () => {
    it("reads collapsed on a navigation split view", async () => {
        expect(await readCollapsed(true)).toEqual({ type: "gboolean", value: true });
    });

    it("reads collapsed as false when the panes stay side by side", async () => {
        expect(await readCollapsed(false)).toEqual({ type: "gboolean", value: false });
    });
});

describe("widget.getProps on an Adwaita application window", () => {
    it("reads current-breakpoint as the breakpoint that applied", async () => {
        const windowRef = createRef<Adw.ApplicationWindow>();

        await renderAdw(
            <AdwApplicationWindow
                ref={windowRef}
                breakpoints={<AdwBreakpoint condition={Adw.BreakpointCondition.parse(WIDE_CONDITION)} />}
            >
                <GtkLabel>Adaptive</GtkLabel>
            </AdwApplicationWindow>,
        );

        await waitFor(async () => {
            expect(await readProperty(getWidget(windowRef), "currentBreakpoint")).toEqual({
                type: "AdwBreakpoint",
                value: "AdwBreakpoint",
            });
        });
    });

    it("reads current-breakpoint as null when no breakpoint applies", async () => {
        const windowRef = createRef<Adw.ApplicationWindow>();

        await renderAdw(
            <AdwApplicationWindow ref={windowRef}>
                <GtkLabel>Static</GtkLabel>
            </AdwApplicationWindow>,
        );

        expect(await readProperty(getWidget(windowRef), "current-breakpoint")).toEqual({
            type: "AdwBreakpoint",
            value: null,
        });
    });
});

describe("widget.getProps subtree depth", () => {
    it(`stops ${String(DEFAULT_SUBTREE_DEPTH)} levels below the widget by default`, async () => {
        const result = await readChain();
        expect(getDescendant(result, DEFAULT_SUBTREE_DEPTH).children).toEqual([]);
        expect(getDescendant(result, DEFAULT_SUBTREE_DEPTH - 1).hiddenChildren).toBeUndefined();
    });

    it("counts the direct children it left out at the limit", async () => {
        const result = await readChain();
        expect(getDescendant(result, DEFAULT_SUBTREE_DEPTH).hiddenChildren).toBe(1);
    });

    it("omits hiddenChildren when nothing was left out", async () => {
        const probe = await probeForLabel("Leaf");
        const result = await probe.read();
        expect(result.children).toEqual([]);
        expect(result.hiddenChildren).toBeUndefined();
    });

    it("returns the widget on its own when maxDepth is zero", async () => {
        const result = await readChain({ maxDepth: 0 });
        expect(result.children).toEqual([]);
        expect(result.hiddenChildren).toBe(1);
    });

    it("reaches deeper descendants when maxDepth is raised", async () => {
        const result = await readChain({ maxDepth: CHAIN_DEPTH });
        expect(getDescendant(result, CHAIN_DEPTH).text).toBe(DEEP_TEXT);
        expect(getDescendant(result, CHAIN_DEPTH - 1).hiddenChildren).toBeUndefined();
    });

    it("rejects a negative maxDepth", async () => {
        await expect(readChain({ maxDepth: -1 })).rejects.toMatchObject({ code: ErrorCode.INVALID_REQUEST });
    });

    it("rejects a fractional maxDepth", async () => {
        await expect(readChain({ maxDepth: 1.5 })).rejects.toMatchObject({ code: ErrorCode.INVALID_REQUEST });
    });
});

describe("widget.getProps subtree width", () => {
    it("stops at the widget budget on a wide subtree", async () => {
        const result = await readWide();
        expect(countNodes(result)).toBe(MAX_SUBTREE_WIDGETS);
        expect(result.hiddenChildren).toBe(WIDE_CHILDREN - MAX_SUBTREE_WIDGETS + 1);
    });

    it("holds the budget however high maxDepth goes", async () => {
        expect(countNodes(await readWide({ maxDepth: 1000 }))).toBe(MAX_SUBTREE_WIDGETS);
    });

    it("spends the budget breadth first, so a later branch still appears", async () => {
        const result = await readBranches();
        expect(result.children.map((child) => child.text)).toEqual([null, SIBLING_TEXT]);
        expect(getDescendant(result, 1).hiddenChildren).toBe(WIDE_CHILDREN - MAX_SUBTREE_WIDGETS + 3);
    });
});

describe("widget.getProps payload", () => {
    it("reaches the application's own content on an Adwaita window", async () => {
        const result = await readWindow(<GtkBox><GtkLabel>{OWN_CONTENT}</GtkLabel></GtkBox>);
        expect(JSON.stringify(result)).toContain(OWN_CONTENT);
    });

    it("keeps the requested properties ahead of the subtree", async () => {
        const result = await readDeepWindow({ properties: ["title"] });
        expect(Object.keys(result)[0]).toBe("properties");
        expect(result.properties?.title).toEqual({ type: "gchararray", value: "Payload" });
    });

    it("does not serialize the whole window subtree for one property", async () => {
        const result = await readDeepWindow({ properties: ["title"] });
        expect(countNodes(result)).toBeLessThanOrEqual(MAX_SUBTREE_WIDGETS);
        expect(JSON.stringify(result).length).toBeLessThan(PAYLOAD_LIMIT);
    });
});

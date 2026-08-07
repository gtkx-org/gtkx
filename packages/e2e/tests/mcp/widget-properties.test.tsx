import type { SerializedProperty, SerializedWidget } from "@gtkx/mcp/internal";
import type { ReactNode, RefObject } from "react";
import { dispatch, WidgetRegistry } from "@gtkx/cli/internal";
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
import { ErrorCode, ProtocolError } from "@gtkx/mcp/internal";
import { rootElement } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { kebabCase } from "@gtkx/utils";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { applicationProps } from "../helpers/application.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

type WidgetProps = SerializedWidget & { properties?: Record<string, SerializedProperty> };
type Probe = { registry: WidgetRegistry; read: (properties?: string[]) => Promise<WidgetProps> };

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.mcpprops");
const WIDE_CONDITION = "max-width: 100000px";

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
    const registry = new WidgetRegistry();
    registry.refresh();
    registry.register(widget);
    const app = new Gtk.Application(applicationProps());
    const widgetId = registry.getOrCreateId(widget);

    return {
        registry,
        read: async (properties) =>
            await dispatch(
                "widget.getProps",
                properties === undefined ? { widgetId } : { widgetId, properties },
                { app, registry },
            ) as WidgetProps,
    };
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
    const result = await probeFor(widget).read([name]);
    const property = result.properties?.[kebabCase(name)];

    if (property === undefined) {
        throw new Error(`Expected property "${name}" in ${JSON.stringify(result.properties)}`);
    }

    return property;
};

describe("widget.getProps summary", () => {
    it("returns the fixed summary alone when no properties are asked for", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref}>Summary</GtkLabel>);
        const result = await probeFor(getWidget(ref)).read();
        expect(result.text).toBe("Summary");
        expect(result.role).toBe("label");
        expect(result.properties).toBeUndefined();
    });

    it("keeps the summary alongside the properties that were asked for", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref}>Both</GtkLabel>);
        const result = await probeFor(getWidget(ref)).read(["label"]);
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
        const result = await probe.read(["parent"]);
        const parent = result.properties?.parent;
        expect(parent?.type).toBe("GtkWidget");
        expect(parent?.value).toBe("GtkBox");
        expect(probe.registry.get(parent?.widgetId ?? "")).toBe(getWidget(boxRef));
    });
});

describe("widget.getProps on an unknown property", () => {
    it("names the widget type and the property", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref}>Nope</GtkLabel>);
        const failure = probeFor(getWidget(ref)).read(["collapsed"]);
        await expect(failure).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
        await expect(failure).rejects.toThrow(/GtkLabel has no readable property 'collapsed'/);
    });

    it("lists the readable properties as a hint", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref}>Nope</GtkLabel>);
        const failure = await getFailure(probeFor(getWidget(ref)).read(["collapsed"]));
        expect(getHint(failure)).toContain("use-markup");
    });
});

describe("widget.getProps on adaptive Adwaita widgets", () => {
    it("reads collapsed on a navigation split view", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        await renderAdw(
            <AdwApplicationWindow>
                <AdwNavigationSplitView ref={viewRef} collapsed={true}>
                    <AdwNavigationPage tag="content" title="Content">
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationSplitView>
            </AdwApplicationWindow>,
        );

        expect(await readProperty(getWidget(viewRef), "collapsed")).toEqual({ type: "gboolean", value: true });
    });

    it("reads collapsed as false when the panes stay side by side", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        await renderAdw(
            <AdwApplicationWindow>
                <AdwNavigationSplitView ref={viewRef} collapsed={false}>
                    <AdwNavigationPage tag="content" title="Content">
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationSplitView>
            </AdwApplicationWindow>,
        );

        expect(await readProperty(getWidget(viewRef), "collapsed")).toEqual({ type: "gboolean", value: false });
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

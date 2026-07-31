import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, type RenderResult, screen } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type RefObject, useCallback, useState } from "react";
import { expect, vi } from "vitest";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";

type ComponentOrDemo = ComponentType<DemoProps> | Demo;

type RenderDemoOptions = {
    onClose?: () => void;
    titlebar?: ComponentType<DemoProps>;
    provider?: ComponentType<DemoProviderProps>;
};

type WrapperArgs = {
    windowRef: RefObject<Gtk.Window | null>;
    onClose: () => void;
    Provider: ComponentType<DemoProviderProps>;
    Titlebar: ComponentType<DemoProps> | undefined;
    demo: Demo | undefined;
};

type DemoShellProps = WrapperArgs & {
    children: ReactNode;
};

type DemoShellSizing = {
    defaultWidth: number;
    defaultHeight: number;
    resizable: boolean;
    deletable: boolean;
};

const nextApplicationId = createApplicationIdFactory("org.gtkx.gtkdemo");

function createApplicationIdFactory(prefix: string): () => string {
    let counter = 0;

    return () => {
        const applicationId = `${prefix}${String(counter)}`;
        counter += 1;

        return applicationId;
    };
}

const makeStringValue = (text: string): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_STRING);
    value.setString(text);

    return value;
};

const makeIntValue = (n: number): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_INT);
    value.setInt(n);

    return value;
};

const makeRgbaValue = (r: number, g: number, b: number, a: number): GObject.Value => {
    const rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GdkRGBA"));
    value.setBoxed(rgba);

    return value;
};

const makeFileValue = (path: string): GObject.Value => {
    const file = Gio.File.newForPath(path);
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GFile"));
    value.setObject(file);

    return value;
};

const isDemo = (value: ComponentOrDemo): value is Demo => typeof value === "object" && "id" in value;
const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

function assignWindowRef(windowRef: RefObject<Gtk.Window | null>, widget: Gtk.Widget | null): void {
    (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
}

function demoShellTitle(demo: Demo | undefined, windowTitle: string | null): string | undefined {
    return windowTitle ?? demo?.windowTitle;
}

function demoShellSizing(demo: Demo | undefined): DemoShellSizing {
    return {
        defaultWidth: demo?.defaultWidth ?? 800,
        defaultHeight: demo?.defaultHeight ?? 600,
        resizable: demo?.resizable ?? true,
        deletable: demo?.deletable ?? true,
    };
}

const DemoShell = ({ windowRef, onClose, Provider, Titlebar, demo, children }: DemoShellProps) => {
    const [windowReady, setWindowReady] = useState(false);
    const [applicationId] = useState(nextApplicationId);
    const { windowTitle, defaultWidget } = useDemo();
    const titlebar = Titlebar ? <Titlebar window={windowRef} onClose={onClose} /> : undefined;
    const sizing = demoShellSizing(demo);

    const handleWindowRef = useCallback(
        (widget: Gtk.Widget | null): void => {
            assignWindowRef(windowRef, widget);

            if (widget) {
                setWindowReady(true);
            }
        },
        [windowRef],
    );

    return (
        <GtkApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Provider window={windowRef} onClose={onClose}>
                <GtkApplicationWindow
                    ref={handleWindowRef}
                    title={demoShellTitle(demo, windowTitle)}
                    defaultWidth={sizing.defaultWidth}
                    defaultHeight={sizing.defaultHeight}
                    resizable={sizing.resizable}
                    deletable={sizing.deletable}
                    cssClasses={demo?.windowCssClasses}
                    defaultWidget={defaultWidget}
                    titlebar={titlebar}
                >
                    {windowReady ? children : null}
                </GtkApplicationWindow>
            </Provider>
        </GtkApplication>
    );
};

const buildWrapper = (args: WrapperArgs): ComponentType<{ children: ReactNode }> => ({ children }) => (
    <DemoProvider demos={args.demo ? [args.demo] : []}>
        <DemoShell
            windowRef={args.windowRef}
            onClose={args.onClose}
            Provider={args.Provider}
            Titlebar={args.Titlebar}
            demo={args.demo}
        >
            {children}
        </DemoShell>
    </DemoProvider>
);

function resolveDemo(componentOrDemo: ComponentOrDemo): Demo | undefined {
    return isDemo(componentOrDemo) ? componentOrDemo : undefined;
}

function resolveComponent(componentOrDemo: ComponentOrDemo): ComponentType<DemoProps> | undefined {
    return isDemo(componentOrDemo) ? componentOrDemo.component : componentOrDemo;
}

function resolveTitlebar(
    componentOrDemo: ComponentOrDemo,
    options: RenderDemoOptions,
): ComponentType<DemoProps> | undefined {
    return options.titlebar ?? resolveDemo(componentOrDemo)?.titlebar;
}

function resolveProvider(
    componentOrDemo: ComponentOrDemo,
    options: RenderDemoOptions,
): ComponentType<DemoProviderProps> {
    return options.provider ?? resolveDemo(componentOrDemo)?.provider ?? PassthroughProvider;
}

const renderDemo = async (
    componentOrDemo: ComponentOrDemo,
    options: RenderDemoOptions = {},
): Promise<RenderResult> => {
    const windowRef = createRef<Gtk.Window | null>();
    const onClose = options.onClose ?? vi.fn();
    const Component = resolveComponent(componentOrDemo);
    expect(Component, "renderDemo: demo has no component").toBeTypeOf("function");
    const ResolvedComponent = Component as ComponentType<DemoProps>;

    return await render(<ResolvedComponent window={windowRef} onClose={onClose} />, {
        container: rootElement,
        wrapper: buildWrapper({
            windowRef,
            onClose,
            Provider: resolveProvider(componentOrDemo, options),
            Titlebar: resolveTitlebar(componentOrDemo, options),
            demo: resolveDemo(componentOrDemo),
        }),
    });
};

const findInactiveSearchToggle = async (): Promise<Gtk.ToggleButton> => {
    const toggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
    expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
    expect(toggle).toHaveObjectProperty("active", false);

    return toggle;
};

const findOpenButton = async (): Promise<Gtk.Button> =>
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open", as: Gtk.Button });

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();

    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
};

const hasBufferTag = (view: Gtk.TextView, tagName: string): boolean => {
    const buffer = view.getBuffer();
    const tag = buffer.getTagTable().lookup(tagName);

    if (!tag) {
        return false;
    }

    const iter = buffer.getStartIter();

    do {
        if (iter.hasTag(tag)) {
            return true;
        }
    } while (iter.forwardChar());

    return false;
};

const getChildren = (widget: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];

    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        children.push(child);
    }

    return children;
};

export {
    createApplicationIdFactory,
    findInactiveSearchToggle,
    findOpenButton,
    getChildren,
    hasBufferTag,
    makeFileValue,
    makeIntValue,
    makeRgbaValue,
    makeStringValue,
    readBufferText,
    renderDemo,
    type RenderDemoOptions,
};

import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, type RenderResult, screen, userEvent, waitFor, type WidgetType } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type RefObject, useCallback, useState } from "react";
import { expect, vi } from "vitest";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";

type RenderDemoOptions = {
    onClose?: () => void;
};

type WrapperArgs = {
    windowRef: RefObject<Gtk.Window | null>;
    onClose: () => void;
    Provider: ComponentType<DemoProviderProps>;
    Titlebar: ComponentType<DemoProps> | undefined;
    demo: Demo;
};

type DemoShellProps = WrapperArgs & {
    children: ReactNode;
};

type DemoShellSizing = {
    defaultWidth: number;
    defaultHeight: number;
    isResizable: boolean;
    isDeletable: boolean;
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

const makeRgba = (r: number, g: number, b: number, a: number): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;

    return rgba;
};

const makeRgbaValue = (r: number, g: number, b: number, a: number): GObject.Value => {
    const rgba = makeRgba(r, g, b, a);
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

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

const findWidget = <T extends Gtk.Widget>(
    root: Gtk.Widget,
    as: WidgetType<T>,
    isMatch: (candidate: T) => boolean = () => true,
): T | null => {
    if (root instanceof as && isMatch(root)) {
        return root;
    }

    for (let child = root.getFirstChild(); child; child = child.getNextSibling()) {
        const found = findWidget(child, as, isMatch);

        if (found) {
            return found;
        }
    }

    return null;
};

const collectWidgets = <T extends Gtk.Widget>(root: Gtk.Widget, as: WidgetType<T>): T[] => {
    const found: T[] = root instanceof as ? [root] : [];

    for (let child = root.getFirstChild(); child; child = child.getNextSibling()) {
        found.push(...collectWidgets(child, as));
    }

    return found;
};

function assignWindowRef(windowRef: RefObject<Gtk.Window | null>, widget: Gtk.Widget | null): void {
    (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
}

function demoShellTitle(demo: Demo, windowTitle: string | null): string | undefined {
    return windowTitle ?? demo.windowTitle;
}

function demoShellSizing(demo: Demo): DemoShellSizing {
    return {
        defaultWidth: demo.defaultWidth ?? 800,
        defaultHeight: demo.defaultHeight ?? 600,
        isResizable: demo.isResizable ?? true,
        isDeletable: demo.isDeletable ?? true,
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
                    resizable={sizing.isResizable}
                    deletable={sizing.isDeletable}
                    cssClasses={demo.windowCssClasses}
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
    <DemoProvider demos={[args.demo]}>
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

const renderDemo = async (demo: Demo, options: RenderDemoOptions = {}): Promise<RenderResult> => {
    const windowRef = createRef<Gtk.Window | null>();
    const onClose = options.onClose ?? vi.fn();
    expect(demo.component, "renderDemo: demo has no component").toBeTypeOf("function");
    const ResolvedComponent = demo.component as ComponentType<DemoProps>;

    return await render(<ResolvedComponent window={windowRef} onClose={onClose} />, {
        container: rootElement,
        wrapper: buildWrapper({
            windowRef,
            onClose,
            Provider: demo.provider ?? PassthroughProvider,
            Titlebar: demo.titlebar,
            demo,
        }),
    });
};

const findInactiveSearchToggle = async (): Promise<Gtk.ToggleButton> => {
    const toggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
    expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
    expect(toggle).toHaveObjectProperty("active", false);

    return toggle;
};

const findButton = async (name: string): Promise<Gtk.Button> =>
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });

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

const findCssLoadedOnMount = async (demo: Demo, needle: string): Promise<string | undefined> => {
    const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");

    try {
        await renderDemo(demo);

        return loadSpy.mock.calls
            .map(([css]) => css)
            .find((css) => typeof css === "string" && css.includes(needle));
    } finally {
        loadSpy.mockRestore();
    }
};

const expectCssReloadedOnEdit = async (demo: Demo, edit: string, needle: string): Promise<void> => {
    const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");

    try {
        await renderDemo(demo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        loadSpy.mockClear();
        await userEvent.clear(textView);
        await userEvent.type(textView, edit);

        await waitFor(() => {
            const loaded = loadSpy.mock.calls.find(([css]) => typeof css === "string" && css.includes(needle));
            expect(loaded, "expected the buffer edit to be loaded into a CssProvider").toBeDefined();
        });
    } finally {
        loadSpy.mockRestore();
    }
};

const activateSearchBar = async (): Promise<{ toggle: Gtk.ToggleButton; bar: Gtk.SearchBar }> => {
    const toggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
    await userEvent.click(toggle);
    const bar = await screen.findByName("search-bar", { as: Gtk.SearchBar });

    await waitFor(() => {
        expect(bar).toHaveObjectProperty("searchModeEnabled", true);
    });

    return { toggle, bar };
};

const openSearchEntry = async (): Promise<Gtk.SearchEntry> => {
    await activateSearchBar();

    return await screen.findByName("search-entry", { as: Gtk.SearchEntry });
};

const getChildren = (widget: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];

    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        children.push(child);
    }

    return children;
};

export {
    activateSearchBar,
    collectWidgets,
    createApplicationIdFactory,
    expectCssReloadedOnEdit,
    findButton,
    findCssLoadedOnMount,
    findInactiveSearchToggle,
    findWidget,
    getChildren,
    hasBufferTag,
    makeFileValue,
    makeIntValue,
    makeRgba,
    makeRgbaValue,
    makeStringValue,
    openSearchEntry,
    readBufferText,
    renderDemo,
    type RenderDemoOptions,
};

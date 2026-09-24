import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import {
    render,
    type RenderResult,
    screen,
    type ScreenshotResult,
    userEvent,
    waitFor,
    type WidgetType,
} from "@gtkx/testing";
import { Buffer } from "node:buffer";
import { type ComponentType, useState } from "react";
import { expect } from "vitest";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";

type RenderDemoOptions = {
    onClose?: () => void;
    areAnimationsEnabled?: boolean;
    isReactStrictMode?: boolean;
};

type DemoShellProps = Pick<DemoProps, "onClose"> & {
    Component: ComponentType<DemoProps>;
    Provider: ComponentType<DemoProviderProps>;
    Titlebar: ComponentType<DemoProps> | undefined;
    demo: Demo;
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

const DemoShell = ({ Component, Provider, Titlebar, demo, ...callbacks }: DemoShellProps) => {
    const [window, setWindow] = useState<Gtk.Window | null>(null);
    const [applicationId] = useState(nextApplicationId);
    const { windowTitle, defaultWidget } = useDemo();
    const titlebar = Titlebar ? <Titlebar window={window} {...callbacks} /> : undefined;
    const sizing = demoShellSizing(demo);

    return (
        <AdwApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Provider window={window} {...callbacks}>
                <GtkApplicationWindow
                    ref={setWindow}
                    title={demoShellTitle(demo, windowTitle)}
                    defaultWidth={sizing.defaultWidth}
                    defaultHeight={sizing.defaultHeight}
                    resizable={sizing.isResizable}
                    deletable={sizing.isDeletable}
                    cssClasses={demo.windowCssClasses}
                    defaultWidget={defaultWidget}
                    titlebar={titlebar}
                >
                    {window !== null && <Component window={window} {...callbacks} />}
                </GtkApplicationWindow>
            </Provider>
        </AdwApplication>
    );
};

const renderDemo = async (demo: Demo, options: RenderDemoOptions = {}): Promise<RenderResult> => {
    const { areAnimationsEnabled, isReactStrictMode, ...callbacks } = options;
    const Component = demo.component;
    if (Component === undefined) {
        throw new Error("Demo has no component");
    }

    return await render(
        <DemoProvider demos={[demo]}>
            <DemoShell
                Component={Component}
                {...callbacks}
                Provider={demo.provider ?? PassthroughProvider}
                Titlebar={demo.titlebar}
                demo={demo}
            />
        </DemoProvider>,
        {
            areAnimationsEnabled: areAnimationsEnabled === true,
            container: rootElement,
            isReactStrictMode,
        },
    );
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

const screenshotColors = (screenshot: ScreenshotResult): Set<string> => {
    const encoded = GLib.Bytes.new(Buffer.from(screenshot.data, "base64"));
    const texture = Gdk.Texture.newFromBytes(encoded);
    const downloader = Gdk.TextureDownloader.new(texture);
    downloader.setFormat(Gdk.MemoryFormat.R8G8B8A8);
    const [downloaded] = downloader.downloadBytes();
    const pixels = downloaded.getData();

    if (pixels === null) {
        throw new TypeError("GDK returned no screenshot pixels");
    }

    const colors: Set<string> = new Set();

    for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
        const pixel = pixels.slice(offset, offset + 4);
        colors.add(pixel.join(","));
    }

    return colors;
};

export {
    activateSearchBar,
    collectWidgets,
    createApplicationIdFactory,
    findButton,
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
    screenshotColors,
    type RenderDemoOptions,
};

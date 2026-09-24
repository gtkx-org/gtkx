import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
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
import { useState } from "react";
import { expect } from "vitest";
import type { Demo } from "../src/demos/types.js";
import { DemoWindow } from "../src/components/demo-window.js";
import { DemoProvider, parseTitle } from "../src/context/demo-context.js";

type RenderDemoOptions = {
    onClose?: () => void;
    areAnimationsEnabled?: boolean;
    isReactStrictMode?: boolean;
};

type DemoHostProps = {
    demo: Demo;
    onClose?: () => void;
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

const makeDialogDismissedError = (): GLib.Error =>
    GLib.Error.newLiteral(Gtk.dialogErrorQuark(), Gtk.DialogError.DISMISSED, "dismissed");

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

const DemoHost = ({ demo, onClose }: DemoHostProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const close = () => {
        setIsOpen(false);
        onClose?.();
    };
    const demoWindow = isOpen
        ? (
                <DemoProvider demos={[demo]}>
                    <DemoWindow onClose={close} />
                </DemoProvider>
            )
        : null;

    if (!demo.isDialogOnly) {
        return demoWindow;
    }

    return (
        <AdwApplicationWindow
            name="main-window"
            title={parseTitle(demo.title).displayTitle}
            defaultWidth={800}
            defaultHeight={600}
        >
            {demoWindow}
        </AdwApplicationWindow>
    );
};

const renderDemo = async (demo: Demo, options: RenderDemoOptions = {}): Promise<RenderResult> => {
    const { areAnimationsEnabled, isReactStrictMode, ...callbacks } = options;
    if (demo.component === undefined) {
        throw new Error("Demo has no component");
    }

    return await render(
        <AdwApplication applicationId={nextApplicationId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <DemoHost demo={demo} {...callbacks} />
        </AdwApplication>,
        {
            areAnimationsEnabled: areAnimationsEnabled === true,
            container: rootElement,
            isReactStrictMode,
        },
    );
};

const findButton = async (name: string): Promise<Gtk.Button> =>
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();

    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
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
    collectWidgets,
    createApplicationIdFactory,
    findButton,
    findWidget,
    getChildren,
    makeDialogDismissedError,
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

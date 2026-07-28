import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkGestureClick, GtkHeaderBar, GtkPicture } from "@gtkx/jsx/gtk";
import { createContext, useContext, useState } from "react";
import nodeEditorSvgUri from "#data/demos/drawing/org.gtk.gtk4.NodeEditor.Devel.svg";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./paintable-svg.tsx?raw";

type PaintableSvgContextValue = {
    svg: Gtk.Svg | null;
    handleOpen: () => void;
};

const PaintableSvgContext = createContext<PaintableSvgContextValue | null>(null);

const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "Paintable/SVG",
    description:
        "This demo shows using GtkSvg to display an SVG image in a GtkPicture that can be scaled by resizing " +
        "the window.",
    keywords: [],
    component: PaintableSvgDemo,
    titlebar: PaintableSvgTitlebar,
    provider: PaintableSvgProvider,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    windowTitle: "Paintable — SVG",
};

const loadSvgFromFile = (file: Gio.File): Gtk.Svg | null => {
    try {
        const [bytes] = file.loadBytes(null);

        return Gtk.Svg.newFromBytes(bytes);
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }

        return null;
    }
};

const pickSvgFile = async (window: Gtk.Window | null): Promise<Gio.File | null> => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open svg image");
    const filter = new Gtk.FileFilter();
    filter.addMimeType("image/svg+xml");
    filter.addMimeType("image/x-gtk-path-animation");
    filter.addPattern("*.gpa");
    const filters = Gio.ListStore.new(Gtk.FileFilter.prototype.__type__);
    filters.append(filter);
    dialog.setFilters(filters);

    try {
        return await dialog.open(window, null);
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }

        return null;
    }
};

const usePaintableSvgContext = (): PaintableSvgContextValue => {
    const ctx = useContext(PaintableSvgContext);

    if (!ctx) {
        throw new Error("PaintableSvgContext is missing");
    }

    return ctx;
};

function PaintableSvgProvider({ window, children }: DemoProviderProps) {
    const [svg, setSvg] = useState<Gtk.Svg | null>(() => loadSvgFromFile(Gio.File.newForUri(nodeEditorSvgUri)));

    const handleOpen = async () => {
        const file = await pickSvgFile(window.current);

        if (!file) {
            return;
        }

        const next = loadSvgFromFile(file);

        if (next) {
            setSvg(next);
        }
    };

    const value = {
        svg,
        handleOpen: () => void handleOpen(),
    };

    return <PaintableSvgContext.Provider value={value}>{children}</PaintableSvgContext.Provider>;
}

function PaintableSvgTitlebar() {
    const { handleOpen } = usePaintableSvgContext();

    return (
        <GtkHeaderBar
            name="paintable-svg-header"
            start={<GtkButton label="_Open" useUnderline onClicked={handleOpen} />}
        />
    );
}

function PaintableSvgDemo() {
    const { svg } = usePaintableSvgContext();

    const handlePressed = () => {
        if (!svg) {
            return;
        }

        const state = svg.getState();
        svg.setState(state < 63 ? state + 1 : 0);
    };

    return (
        <GtkPicture
            name="picture"
            paintable={svg}
            widthRequest={16}
            heightRequest={16}
            controllers={<GtkGestureClick onPressed={handlePressed} />}
        />
    );
}

export { paintableSvgDemo };

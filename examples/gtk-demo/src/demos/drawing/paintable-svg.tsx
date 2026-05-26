import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkGestureClick, GtkHeaderBar, GtkPicture } from "@gtkx/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import nodeEditorSvgUri from "./org.gtk.gtk4.NodeEditor.Devel.svg";
import sourceCode from "./paintable-svg.tsx?raw";

const loadSvgFromFile = (file: Gio.File): Gtk.Svg | null => {
    try {
        const [bytes] = file.loadBytes(null);
        return Gtk.Svg.newFromBytes(bytes);
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
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

    const filters = Gio.ListStore.new(Gtk.FileFilter.prototype.__gtype__);
    filters.append(filter);
    dialog.setFilters(filters);

    try {
        return await dialog.open(window, null);
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        return null;
    }
};

interface PaintableSvgContextValue {
    svg: Gtk.Svg | null;
    handleOpen: () => void;
}

const PaintableSvgContext = createContext<PaintableSvgContextValue | null>(null);

const usePaintableSvgContext = (): PaintableSvgContextValue => {
    const ctx = useContext(PaintableSvgContext);
    if (!ctx) throw new Error("PaintableSvgContext is missing");
    return ctx;
};

const PaintableSvgProvider = ({ window, children }: DemoProviderProps) => {
    const [svg, setSvg] = useState<Gtk.Svg | null>(() => loadSvgFromFile(Gio.fileNewForUri(nodeEditorSvgUri)));

    const handleOpen = useCallback(async () => {
        const file = await pickSvgFile(window.current);
        if (!file) return;
        const next = loadSvgFromFile(file);
        if (next) setSvg(next);
    }, [window]);

    const value = useMemo<PaintableSvgContextValue>(
        () => ({ svg, handleOpen: () => void handleOpen() }),
        [svg, handleOpen],
    );
    return <PaintableSvgContext.Provider value={value}>{children}</PaintableSvgContext.Provider>;
};

const PaintableSvgTitlebar = () => {
    const { handleOpen } = usePaintableSvgContext();
    return (
        <GtkHeaderBar name="paintable-svg-header">
            <GtkHeaderBar.PackStart>
                <GtkButton label="_Open" useUnderline onClicked={handleOpen} />
            </GtkHeaderBar.PackStart>
        </GtkHeaderBar>
    );
};

const PaintableSvgDemo = () => {
    const { svg } = usePaintableSvgContext();

    const handlePressed = useCallback(() => {
        if (!svg) return;
        const state = svg.getState();
        svg.setState(state < 63 ? state + 1 : 0);
    }, [svg]);

    return (
        <GtkPicture name="picture" paintable={svg} widthRequest={16} heightRequest={16}>
            <GtkGestureClick onPressed={handlePressed} />
        </GtkPicture>
    );
};

export const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "Paintable/SVG",
    description:
        "This demo shows using GtkSvg to display an SVG image in a GtkPicture that can be scaled by resizing the window.",
    keywords: [],
    component: PaintableSvgDemo,
    titlebar: PaintableSvgTitlebar,
    provider: PaintableSvgProvider,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    windowTitle: "Paintable — SVG",
};

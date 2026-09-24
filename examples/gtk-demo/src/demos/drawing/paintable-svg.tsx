import type * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GListStore } from "@gtkx/jsx/gio";
import {
    GtkButton,
    GtkFileDialog,
    GtkFileFilter,
    GtkGestureClick,
    GtkHeaderBar,
    GtkPicture,
    GtkSvg,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import nodeEditorSvgPath from "../../../data/demos/drawing/org.gtk.gtk4.NodeEditor.Devel.svg?resource";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
import sourceCode from "./paintable-svg.tsx?raw";

type PaintableSvgContextValue = {
    source: SvgSource;
    handleOpen: () => void;
};

type ResourceSvgSource = { id: number; kind: "resource"; resource: string };
type BytesSvgSource = { id: number; kind: "bytes"; bytes: GLib.Bytes };
type SvgSource = ResourceSvgSource | BytesSvgSource;

const PaintableSvgContext = createContext<PaintableSvgContextValue | null>(null);

const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "Paintable/SVG",
    description: "A generated GtkSvg element displays a scalable image and loads another SVG from a file dialog.",
    keywords: [],
    component: PaintableSvgDemo,
    titlebar: PaintableSvgTitlebar,
    provider: PaintableSvgProvider,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    windowTitle: "Paintable — SVG",
};

const loadSvgFromFile = (file: Gio.File): GLib.Bytes | null => {
    try {
        const [bytes] = file.loadBytes(null);

        return bytes;
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }

        return null;
    }
};

const pickSvgFile = async (
    dialog: Gtk.FileDialog,
    window: Gtk.Window | null,
    cancellable: Gio.Cancellable,
): Promise<Gio.File | null> => {
    try {
        return await dialog.open(window, cancellable);
    } catch (error) {
        if (!isCancellation(error) && error instanceof Error) {
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

function useSvgFileDialog() {
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);
    const [filter, setFilter] = useState<Gtk.FileFilter | null>(null);
    const [filters, setFilters] = useState<Gio.ListStore | null>(null);
    const cancellable = useCancellable();

    useEffect(() => {
        if (filters !== null && filter !== null) {
            filters.splice(0, filters.getNItems(), [filter]);
        }
    }, [filter, filters]);

    const portal = createPortal(
        <>
            <GtkFileFilter
                ref={setFilter}
                mimeTypes={["image/svg+xml", "image/x-gtk-path-animation"]}
                patterns={["*.gpa"]}
            />
            <GListStore ref={setFilters} itemType={Gtk.FileFilter.prototype.__type__} />
            <GtkFileDialog ref={setDialog} title="Open svg image" filters={filters} defaultFilter={filter} />
            {cancellable.element}
        </>,
        rootElement,
    );

    return { dialog, cancellable, portal };
}

function PaintableSvgProvider({ window, children }: DemoProviderProps) {
    const [source, setSource] = useState<SvgSource>({ id: 0, kind: "resource", resource: nodeEditorSvgPath });
    const { dialog, cancellable, portal } = useSvgFileDialog();

    const handleOpen = async () => {
        if (dialog === null || cancellable.cancellable === null) {
            return;
        }

        try {
            const file = await pickSvgFile(dialog, window, cancellable.cancellable);

            if (!file) {
                return;
            }

            const bytes = loadSvgFromFile(file);

            if (bytes) {
                setSource((current) => ({ id: current.id + 1, kind: "bytes", bytes }));
            }
        } finally {
            cancellable.renew();
        }
    };

    const value = {
        source,
        handleOpen: () => void handleOpen(),
    };

    return (
        <>
            {portal}
            <PaintableSvgContext.Provider value={value}>{children}</PaintableSvgContext.Provider>
        </>
    );
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
    const { source } = usePaintableSvgContext();
    const [svg, setSvg] = useState<Gtk.Svg | null>(null);

    useLayoutEffect(() => {
        if (svg !== null && source.kind === "bytes") {
            svg.loadFromBytes(source.bytes);
        }
    }, [source, svg]);

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
            paintable={(
                <GtkSvg
                    key={source.id}
                    ref={setSvg}
                    {...(source.kind === "resource" ? { resource: source.resource } : {})}
                />
            )}
            widthRequest={16}
            heightRequest={16}
            controllers={<GtkGestureClick onPressed={handlePressed} />}
        />
    );
}

export { paintableSvgDemo };

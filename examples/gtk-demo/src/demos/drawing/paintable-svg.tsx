import type * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GListStore } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkButton,
    GtkFileDialog,
    GtkFileFilter,
    GtkHeaderBar,
    GtkPicture,
    GtkSvg,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { errorMessage } from "@gtkx/utils";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import nodeEditorSvgPath from "../../../data/demos/drawing/org.gtk.gtk4.NodeEditor.Devel.svg?resource";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
import sourceCode from "./paintable-svg.tsx?raw";

type PaintableSvgContextValue = {
    svg: Gtk.Svg | null;
    isOpening: boolean;
    error: string | null;
    clearError: () => void;
    handleOpen: () => void;
};

type ResourceSvgSource = { id: string; kind: "resource"; resource: string };
type BytesSvgSource = { id: string; kind: "bytes"; bytes: GLib.Bytes };
type SvgSource = ResourceSvgSource | BytesSvgSource;
type LoadedSvg = { source: SvgSource; svg: Gtk.Svg };

type SvgDocumentProps = {
    source: SvgSource;
    onLoaded: (source: SvgSource, svg: Gtk.Svg) => void;
    onError: (source: SvgSource, message: string) => void;
};

type SvgDocumentsProps = Omit<SvgDocumentProps, "source"> & { sources: SvgSource[] };

const PaintableSvgContext = createContext<PaintableSvgContextValue | null>(null);
const initialSource: SvgSource = { id: "initial", kind: "resource", resource: nodeEditorSvgPath };

const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "Paintable/SVG",
    description: "A generated GtkSvg element displays a scalable image and loads another SVG from a file dialog.",
    keywords: ["GtkPicture", "GtkSvg"],
    component: PaintableSvgDemo,
    titlebar: PaintableSvgTitlebar,
    provider: PaintableSvgProvider,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    windowTitle: "Paintable — SVG",
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
                name="SVG images"
                mimeTypes={["image/svg+xml", "image/x-gtk-path-animation"]}
                patterns={["*.svg", "*.gpa"]}
            />
            <GListStore ref={setFilters} itemType={Gtk.FileFilter.prototype.__type__} />
            <GtkFileDialog ref={setDialog} title="Open SVG image" filters={filters} defaultFilter={filter} />
            {cancellable.element}
        </>,
        rootElement,
    );

    return { dialog, cancellable, portal };
}

function PaintableSvgProvider({ window, children }: DemoProviderProps) {
    const [loaded, setLoaded] = useState<LoadedSvg | null>(null);
    const [pending, setPending] = useState<SvgSource | null>(initialSource);
    const [isOpening, setIsOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dialog, cancellable, portal } = useSvgFileDialog();
    const handleLoaded = useCallback((source: SvgSource, svg: Gtk.Svg) => {
        setLoaded({ source, svg });
        setPending(null);
    }, []);
    const handleError = useCallback((source: SvgSource, message: string) => {
        setPending((current) => current?.id === source.id ? null : current);
        setError(message);
    }, []);

    const handleOpen = async () => {
        if (dialog === null || cancellable.cancellable === null) {
            return;
        }

        setIsOpening(true);

        try {
            const file = await dialog.open(window, cancellable.cancellable);
            const [bytes] = await file.loadBytesAsync(cancellable.cancellable);
            setPending({ id: crypto.randomUUID(), kind: "bytes", bytes });
        } catch (error_) {
            if (!isCancellation(error_)) {
                setError(errorMessage(error_));
            }
        } finally {
            setIsOpening(false);
            cancellable.renew();
        }
    };

    const value = {
        svg: loaded?.svg ?? null,
        isOpening: isOpening || pending !== null,
        error,
        clearError: () => {
            setError(null);
        },
        handleOpen: () => void handleOpen(),
    };
    const documents = [loaded?.source, pending].filter((source) => source != null);

    return (
        <>
            {portal}
            <SvgDocuments sources={documents} onLoaded={handleLoaded} onError={handleError} />
            <PaintableSvgContext.Provider value={value}>{children}</PaintableSvgContext.Provider>
        </>
    );
}

function PaintableSvgTitlebar() {
    const { handleOpen, isOpening } = usePaintableSvgContext();

    return (
        <GtkHeaderBar
            name="paintable-svg-header"
            start={<GtkButton label="_Open" useUnderline sensitive={!isOpening} onClicked={handleOpen} />}
        />
    );
}

function SvgDocument({ source, onLoaded, onError }: SvgDocumentProps) {
    const [svg, setSvg] = useState<Gtk.Svg | null>(null);
    const parseErrors = useRef<string[]>([]);
    const parsing = useRef(false);

    useLayoutEffect(() => {
        if (svg === null) {
            return;
        }

        parseErrors.current = [];
        parsing.current = true;

        if (source.kind === "bytes") {
            svg.loadFromBytes(source.bytes);
        } else {
            svg.loadFromResource(source.resource);
        }

        parsing.current = false;
        const message = parseErrors.current[0];

        if (message === undefined) {
            onLoaded(source, svg);
        } else {
            onError(source, message);
        }
    }, [source, svg, onLoaded, onError]);

    return (
        <GtkSvg
            ref={setSvg}
            onError={(failure) => {
                const message = failure.message;

                if (parsing.current) {
                    parseErrors.current.push(message);
                } else {
                    queueMicrotask(() => {
                        onError(source, message);
                    });
                }
            }}
        />
    );
}

const SvgDocuments = ({ sources, ...callbacks }: SvgDocumentsProps) => createPortal(
    sources.map((source) => <SvgDocument key={source.id} source={source} {...callbacks} />),
    rootElement,
);

function PaintableSvgDemo() {
    const { svg, error, clearError } = usePaintableSvgContext();

    return (
        <GtkBox>
            <GtkButton
                accessibleLabel="Next SVG state"
                cssClasses={["flat"]}
                hexpand
                vexpand
                sensitive={svg !== null}
                onClicked={() => {
                    if (svg !== null) {
                        svg.setState((svg.getState() + 1) % 64);
                    }
                }}
            >
                <GtkPicture
                    name="picture"
                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                    paintable={svg}
                    widthRequest={16}
                    heightRequest={16}
                />
            </GtkButton>
            {error !== null && (
                <AdwAlertDialog
                    heading="Could not load image"
                    body={error}
                    responses={[{ id: "ok", label: "_OK" }]}
                    defaultResponse="ok"
                    closeResponse="ok"
                    onClosed={clearError}
                />
            )}
        </GtkBox>
    );
}

export { paintableSvgDemo };

import type { Context } from "@gtkx/ffi/cairo";
import { ImageSurface } from "@gtkx/ffi/cairo";
import * as GdkPixbuf from "@gtkx/ffi/gdkpixbuf";
import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkDrawingArea, GtkHeaderBar, GtkImage, x } from "@gtkx/react";
import { useCallback, useLayoutEffect, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./paintable-svg.tsx?raw";

const DEFAULT_SVG_PATH = "/usr/share/icons/hicolor/scalable/apps/org.gtk.gtk4.NodeEditor.Devel.svg";
let tmpPngPath: string | undefined;

function getTmpPngPath(): string {
    if (!tmpPngPath) {
        tmpPngPath = GLib.buildFilenamev([GLib.getTmpDir(), "gtkx-svg-paintable.png"]);
    }
    return tmpPngPath;
}

let surfaceCache: { surface: ImageSurface; path: string; width: number; height: number } | null = null;

function renderSvgToSurface(path: string, width: number, height: number): ImageSurface | null {
    if (surfaceCache?.path === path && surfaceCache.width === width && surfaceCache.height === height) {
        return surfaceCache.surface;
    }
    try {
        const pixbuf = GdkPixbuf.Pixbuf.newFromFileAtScale(path, width, height, true);
        pixbuf.savev(getTmpPngPath(), "png");
        const surface = ImageSurface.createFromPng(getTmpPngPath());
        surfaceCache = { surface, path, width, height };
        return surface;
    } catch {
        surfaceCache = null;
        return null;
    }
}

const PaintableSvgDemo = ({ window }: DemoProps) => {
    const [filePath, setFilePath] = useState(DEFAULT_SVG_PATH);
    const isSymbolic = filePath.includes("symbolic");

    useLayoutEffect(() => {
        window.current?.setDefaultSize(330, 330);
    }, [window]);

    const handleOpen = useCallback(async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open SVG image");

        const filters = new Gio.ListStore(GObject.typeFromName("GtkFileFilter"));
        const filter = new Gtk.FileFilter();
        filter.setName("SVG images");
        filter.addMimeType("image/svg+xml");
        filters.append(filter);
        dialog.setFilters(filters);

        try {
            const file = await dialog.openAsync(window.current);
            const path = file.getPath();
            if (path) {
                setFilePath(path);
            }
        } catch {
            // user cancelled
        }
    }, [window]);

    const handleDraw = useCallback(
        (cr: Context, width: number, height: number) => {
            if (width <= 0 || height <= 0) return;

            const surface = renderSvgToSurface(filePath, width, height);
            if (!surface) {
                cr.setSourceRgba(238 / 255, 106 / 255, 167 / 255, 1.0);
                cr.rectangle(0, 0, width, height);
                cr.fill();
                return;
            }

            const sw = surface.getWidth();
            const sh = surface.getHeight();
            cr.setSourceSurface(surface, (width - sw) / 2, (height - sh) / 2);
            cr.paint();
        },
        [filePath],
    );

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkButton label="_Open" useUnderline onClicked={() => void handleOpen()} />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>

            {isSymbolic ? (
                <GtkImage
                    file={filePath}
                    pixelSize={64}
                    hexpand
                    vexpand
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                />
            ) : (
                <GtkDrawingArea onDraw={handleDraw} hexpand vexpand />
            )}
        </>
    );
};

export const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "Paintable/SVG",
    description:
        "This demo shows rendering an SVG image that can be scaled by resizing the window. The image is re-rendered at the widget's current size for resolution-independent display.",
    keywords: ["paintable", "svg", "vector", "scalable", "graphics", "GtkDrawingArea", "GdkPixbuf"],
    component: PaintableSvgDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
};

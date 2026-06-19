import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef, useState } from "react";
import { type AdwDialogLike, isAdwDialog } from "../utils/gtype-predicates.js";

/** A top-level surface driven by {@link useWindowPresentation}: a window or an Adwaita dialog. */
export type TopLevelSurface = Gtk.Window | AdwDialogLike;

/**
 * Presents `surface` and returns its teardown. A window is shown with
 * `present()` and torn down with `destroy()` after its default widget is
 * cleared — a `Gtk.Window` holds its default widget as a borrowed back-pointer
 * GObject finalization could leave dangling, so resetting it synchronously
 * while still alive is required. An `Adw.Dialog` is presented against the given
 * parent window and force-closed.
 */
const presentSurface = (surface: TopLevelSurface, parent: Gtk.Window | null): (() => void) => {
    if (isAdwDialog(surface)) {
        surface.present(parent);
        return () => surface.forceClose();
    }
    surface.present();
    return () => {
        surface.setDefaultWidget(null);
        surface.destroy();
    };
};

/**
 * Drives a top-level surface's lifecycle: returns a callback ref to bind to a
 * window or `Adw.Dialog` element that presents the surface once mounted and
 * tears it down on unmount.
 *
 * A window is shown with `present()` and destroyed (after clearing its default
 * widget) on unmount; an `Adw.Dialog` is presented against `parent` and
 * force-closed. The surface is captured through the returned ref and presented
 * from a layout effect keyed on its identity, so a `parent` change after mount
 * never re-presents an already-shown surface. Pair it with {@link useForwardedRef}
 * to also forward the surface to a caller's own ref.
 *
 * @param parent - The window an `Adw.Dialog` surface is presented against, read
 *   at present time; ignored for windows.
 * @returns The callback ref to bind to the surface element.
 *
 * @example
 * ```tsx
 * const capture = useWindowPresentation();
 * return <GtkWindow ref={capture} title="Hello" />;
 * ```
 */
export function useWindowPresentation(parent: Gtk.Window | null = null): (surface: TopLevelSurface | null) => void {
    const [surface, setSurface] = useState<TopLevelSurface | null>(null);
    const parentRef = useRef(parent);
    parentRef.current = parent;

    useLayoutEffect(() => {
        if (!surface) return;
        return presentSurface(surface, parentRef.current);
    }, [surface]);

    return setSurface;
}

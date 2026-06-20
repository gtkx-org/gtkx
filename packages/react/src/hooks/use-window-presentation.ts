import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef, useState } from "react";
import { type AdwDialogLike, isAdwDialog } from "../utils/gtype-predicates.js";

export type TopLevelSurface = Gtk.Window | AdwDialogLike;

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

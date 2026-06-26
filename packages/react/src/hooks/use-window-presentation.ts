import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef, useState } from "react";
import { type AdwDialogLike, isAdwDialog } from "../utils/gtype-predicates.js";

export type Toplevel = Gtk.Window | AdwDialogLike;

const presentToplevel = (toplevel: Toplevel, parent: Gtk.Window | null): (() => void) => {
    if (isAdwDialog(toplevel)) {
        toplevel.present(parent);
        return () => toplevel.forceClose();
    }
    toplevel.present();
    return () => {
        toplevel.setDefaultWidget(null);
        toplevel.destroy();
    };
};

export function useWindowPresentation(parent: Gtk.Window | null = null): (toplevel: Toplevel | null) => void {
    const [toplevel, setToplevel] = useState<Toplevel | null>(null);
    const parentRef = useRef(parent);
    parentRef.current = parent;

    useLayoutEffect(() => {
        if (!toplevel) return;
        return presentToplevel(toplevel, parentRef.current);
    }, [toplevel]);

    return setToplevel;
}

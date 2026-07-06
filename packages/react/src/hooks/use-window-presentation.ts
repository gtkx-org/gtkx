import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useState } from "react";

export function useWindowPresentation(): (window: Gtk.Window | null) => void {
    const [toplevel, setToplevel] = useState<Gtk.Window | null>(null);

    useLayoutEffect(() => {
        if (!toplevel) return;
        toplevel.present();
        return () => {
            toplevel.setDefaultWidget(null);
            toplevel.destroy();
        };
    }, [toplevel]);

    return setToplevel;
}

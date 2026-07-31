import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, use } from "react";

const ParentWindowContext: Context<Gtk.Window | null> = createContext<Gtk.Window | null>(null);

/**
 * Returns the `Gtk.Window` of the nearest window ancestor, throwing if used outside one. A window withholds
 * its children until its GObject exists, so the window is always constructed by the time this is called.
 */
const useParentWindow = (): Gtk.Window => {
    const window = use(ParentWindowContext);

    if (!window) {
        throw new Error("useParentWindow must be called within a window element");
    }

    return window;
};

export { ParentWindowContext, useParentWindow };

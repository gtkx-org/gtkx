import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, use } from "react";

const ParentWindowContext: Context<Gtk.Window | null> = createContext<Gtk.Window | null>(null);

/**
 * Returns the `Gtk.Window` of the nearest window ancestor. This is `null` on the first render even inside a
 * window, because a window provides itself only once its GObject exists, and stays `null` outside one. The
 * component re-renders when it resolves, so derive from the value rather than reading it once.
 */
const useParentWindow = (): Gtk.Window | null => use(ParentWindowContext);

export { ParentWindowContext, useParentWindow };

import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, useContext } from "react";

export const ParentWindowContext: Context<Gtk.Window | null> = createContext<Gtk.Window | null>(null);

/**
 * Returns the `Gtk.Window` provided by the nearest window ancestor, or `null` when there is none.
 */
export const useParentWindow = (): Gtk.Window | null => useContext(ParentWindowContext);

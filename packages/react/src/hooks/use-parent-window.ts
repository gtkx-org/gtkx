import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, use } from "react";

const ParentWindowContext: Context<Gtk.Window | null> = createContext<Gtk.Window | null>(null);

/**
 * Returns the `Gtk.Window` provided by the nearest window ancestor, or `null` when there is none.
 */
const useParentWindow = (): Gtk.Window | null => use(ParentWindowContext);

export { ParentWindowContext, useParentWindow };

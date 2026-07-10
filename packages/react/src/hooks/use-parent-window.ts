import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, useContext } from "react";

export const ParentWindowContext: Context<Gtk.Window | null> = createContext<Gtk.Window | null>(null);

export const useParentWindow = (): Gtk.Window | null => useContext(ParentWindowContext);

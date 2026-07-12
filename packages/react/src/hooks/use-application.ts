import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, useContext } from "react";

export const ApplicationContext: Context<Gtk.Application | null> = createContext<Gtk.Application | null>(null);

/**
 * Returns the `Gtk.Application` provided by the nearest `Application` ancestor, throwing if used outside one.
 */
export const useApplication = (): Gtk.Application => {
    const context = useContext(ApplicationContext);

    if (!context) {
        throw new Error("Expected ApplicationContext: useApplication must be called within Application");
    }

    return context;
};

import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, use } from "react";

const ApplicationContext: Context<Gtk.Application | null> = createContext<Gtk.Application | null>(null);

/**
 * Returns the `Gtk.Application` provided by the nearest application element, normally `AdwApplication`.
 */
const useApplication = (): Gtk.Application => {
    const context = use(ApplicationContext);

    if (!context) {
        throw new Error("useApplication must be called within an application element");
    }

    return context;
};

export { ApplicationContext, useApplication };

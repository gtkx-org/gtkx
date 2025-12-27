import { start, stop } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { formatBoundaryError, formatRenderError } from "./errors.js";
import { reconciler } from "./reconciler.js";

export const ApplicationContext = createContext<Gtk.Application | null>(null);

export const useApplication = (): Gtk.Application => {
    const context = useContext(ApplicationContext);

    if (!context) {
        throw new Error("Expected ApplicationContext: useApplication must be called within Application");
    }

    return context;
};

let container: unknown = null;

export const render = (element: ReactNode, appId: string, flags?: Gio.ApplicationFlags): void => {
    const app = start(appId, flags);
    const instance = reconciler.getInstance();

    container = instance.createContainer(
        app,
        0,
        null,
        false,
        null,
        "",
        (error: unknown) => {
            throw formatRenderError(error);
        },
        (error: unknown) => {
            const formattedError = formatBoundaryError(error);
            console.error(formattedError.toString());
        },
        () => {},
        () => {},
        null,
    );

    instance.updateContainer(
        <ApplicationContext.Provider value={app}>{element}</ApplicationContext.Provider>,
        container,
        null,
        () => {},
    );
};

export const update = (element: ReactNode): void => {
    reconciler.getInstance().updateContainer(element, container, null, () => {});
};

export const quit = () => {
    reconciler.getInstance().updateContainer(null, container, null, () => {
        setTimeout(() => {
            stop();
        }, 0);
    });

    return true;
};

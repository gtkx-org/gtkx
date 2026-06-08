import {
    AdwApplicationWindow as AdwApplicationWindowCompound,
    GtkApplicationWindow as GtkApplicationWindowCompound,
} from "@gtkx/react-jsx/compounds";
import type { AdwApplicationWindowProps, GtkApplicationWindowProps } from "@gtkx/react-jsx/jsx";
import type { ReactNode } from "react";
import { useApplication } from "../render.js";

/**
 * Declarative wrapper for `Gtk.ApplicationWindow`.
 *
 * Reads the enclosing application from {@link useApplication} and passes it as
 * the window's construct-only `application` property, so the window is owned by
 * the application without the caller wiring it manually. The window's `titlebar`
 * slot and lifecycle (present on mount, destroy on unmount) are handled by the
 * generated compound and the reconciler.
 *
 * @param props - Standard `Gtk.ApplicationWindow` props.
 */
export const GtkApplicationWindow = (props: GtkApplicationWindowProps): ReactNode => {
    const application = useApplication();
    return <GtkApplicationWindowCompound application={application} {...props} />;
};

/**
 * Declarative wrapper for `Adw.ApplicationWindow`.
 *
 * Reads the enclosing application from {@link useApplication} and passes it as
 * the window's construct-only `application` property. The `content`/`titlebar`
 * slots and the window lifecycle are handled by the generated compound and the
 * reconciler.
 *
 * @param props - Standard `Adw.ApplicationWindow` props.
 */
export const AdwApplicationWindow = (props: AdwApplicationWindowProps): ReactNode => {
    const application = useApplication();
    return <AdwApplicationWindowCompound application={application} {...props} />;
};

import {
    AdwAlertDialog as AdwAlertDialogCompound,
    AdwApplicationWindow as AdwApplicationWindowCompound,
    GtkApplicationWindow as GtkApplicationWindowCompound,
    GtkWindow as GtkWindowCompound,
} from "@gtkx/react-jsx/compounds";
import type {
    AdwAboutDialogProps,
    AdwAlertDialogProps,
    AdwApplicationWindowProps,
    AdwDialogProps,
    AdwPreferencesWindowProps,
    GtkAboutDialogProps,
    GtkApplicationWindowProps,
    GtkWindowProps,
} from "@gtkx/react-jsx/jsx";
import type { ReactNode } from "react";
import { useApplication } from "../render.js";
import { withTopLevel } from "./top-level.js";

/**
 * Declarative `Gtk.Window`. Presented on mount and destroyed on unmount; a window
 * nested under another window is made transient for it.
 */
export const GtkWindow = withTopLevel<GtkWindowProps>(GtkWindowCompound);

/** Declarative `Adw.Dialog`, presented against its enclosing window and force-closed on unmount. */
export const AdwDialog = withTopLevel<AdwDialogProps>("AdwDialog");

/** Declarative `Gtk.AboutDialog`, presented on mount and destroyed on unmount. */
export const GtkAboutDialog = withTopLevel<GtkAboutDialogProps>("GtkAboutDialog");

/** Declarative `Adw.AboutDialog`, presented against its enclosing window and force-closed on unmount. */
export const AdwAboutDialog = withTopLevel<AdwAboutDialogProps>("AdwAboutDialog");

/** Declarative `Adw.PreferencesWindow`, presented on mount and destroyed on unmount. */
export const AdwPreferencesWindow = withTopLevel<AdwPreferencesWindowProps>("AdwPreferencesWindow");

/** Declarative `Adw.AlertDialog`, presented against its enclosing window and force-closed on unmount. */
export const AdwAlertDialog = withTopLevel<AdwAlertDialogProps>(AdwAlertDialogCompound);

const GtkApplicationWindowSurface = withTopLevel<GtkApplicationWindowProps>(GtkApplicationWindowCompound);
const AdwApplicationWindowSurface = withTopLevel<AdwApplicationWindowProps>(AdwApplicationWindowCompound);

/**
 * Declarative `Gtk.ApplicationWindow`.
 *
 * Reads the enclosing application from {@link useApplication} and passes it as
 * the window's construct-only `application` property, then presents the window on
 * mount and destroys it on unmount.
 *
 * @param props - Standard `Gtk.ApplicationWindow` props.
 */
export const GtkApplicationWindow = (props: GtkApplicationWindowProps): ReactNode => {
    const application = useApplication();
    return <GtkApplicationWindowSurface application={application} {...props} />;
};

/**
 * Declarative `Adw.ApplicationWindow`.
 *
 * Reads the enclosing application from {@link useApplication} and passes it as
 * the window's construct-only `application` property, then presents the window on
 * mount and destroys it on unmount.
 *
 * @param props - Standard `Adw.ApplicationWindow` props.
 */
export const AdwApplicationWindow = (props: AdwApplicationWindowProps): ReactNode => {
    const application = useApplication();
    return <AdwApplicationWindowSurface application={application} {...props} />;
};

declare module "virtual:gtkx-config" {
    /** The GObject signal each `on…` handler prop connects to, keyed by GLib type name. */
    export const signals: Record<string, Record<string, string>>;
    /** Props GTK accepts only while an object is being built, keyed by GLib type name. */
    export const constructOnlyProps: Record<string, Set<string>>;
    /** Props that can be passed to the constructor, keyed by GLib type name. */
    export const constructProps: Record<string, Set<string>>;
    /** The value each property is reset to when its prop is removed, keyed by GLib type name. */
    export const defaultProps: Record<string, Record<string, unknown>>;
    /** The application id from `gtkx.config.ts`, used as the default for `<GtkApplication>`. */
    export const applicationId: import("@gtkx/config").ResolvedConfig["applicationId"];
    /** Signals a user can trigger, which stay blocked while props are written, keyed by GLib type name. */
    export const userEventSignals: import("@gtkx/config").ResolvedConfig["userEventSignals"];
    /** The element configuration the project's `gtkx.config.ts` contributes, keyed by GLib type name. */
    export const elements: Record<string, import("@gtkx/react/config").ElementConfig>;
}

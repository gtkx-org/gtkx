declare module "virtual:gtkx-config" {
    /** The GObject signal each `on…` handler prop connects to, keyed by GLib type name. */
    export const signals: Record<string, Record<string, string>>;
    /** The GObject name of a property, what a write may do to it, and the value it resets to. */
    export type PropertyEntry = [name: string, flags: number, defaultValue?: unknown];
    /** Every property a GLib type declares itself, keyed by GLib type name and then by accessor. */
    export const properties: Record<string, Record<string, PropertyEntry>>;
    /** The application id from `gtkx.config.ts`, used as the default for application elements. */
    export const applicationId: import("@gtkx/config").ResolvedConfig["applicationId"];
    /** The resource base derived from `gtkx.config.ts`, used by application elements. */
    export const resourceBasePath: string;
    /**
     * Signals a user can trigger, which stay blocked while props are written, keyed by GLib type name.
     * `notify` is blocked only for the property being written.
     */
    export const userEventSignals: import("@gtkx/config").ResolvedConfig["userEventSignals"];
    /** The element configuration the project's `gtkx.config.ts` contributes, keyed by GLib type name. */
    export const elements: Record<string, import("@gtkx/react/config").ElementConfig>;
}

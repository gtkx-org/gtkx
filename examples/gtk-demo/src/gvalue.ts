import * as GObject from "@gtkx/gi/gobject";

/**
 * Builds a `GObject.Value` of the given `GType`, runs `populate` to set its
 * payload, and returns it.
 *
 * Use this to hand a typed value to GTK APIs that take a raw `GValue`, such as
 * `Gdk.ContentProvider.newForValue`.
 *
 * @param gtype - The `GType` to initialize the value with.
 * @param populate - Callback that sets the value's payload via `setString`,
 *   `setBoxed`, `setObject`, etc.
 */
export const buildValue = (gtype: GObject.GType, populate: (value: GObject.Value) => void): GObject.Value => {
    const value = new GObject.Value();
    value.init(gtype);
    populate(value);
    return value;
};

/**
 * Abstract base class for all native GLib/GTK objects.
 * All generated classes, interfaces, and boxed types extend this.
 */
export abstract class NativeObject {
    /** The GLib type name (e.g., "GtkButton"). Must be overridden by subclasses. */
    static readonly glibTypeName: string;

    /** The object type category. Must be overridden by subclasses. */
    static readonly objectType: "gobject" | "interface" | "boxed";

    /** The native object id for the underlying GLib object */
    id: unknown;

    // biome-ignore lint/complexity/noUselessConstructor: ignore
    // biome-ignore lint/suspicious/noExplicitAny: ignore
    constructor(..._args: any[]) {}
}

/** Type representing a NativeObject subclass constructor */
// biome-ignore lint/suspicious/noExplicitAny: required for class type
export type NativeClass<T extends NativeObject = NativeObject> = typeof NativeObject & (new (...args: any[]) => T);

/**
 * Flag to prevent intermediate base class constructors from creating objects.
 * When a subclass is being instantiated, this flag is set to true to skip
 * object creation in parent constructors. Only the outermost constructor
 * will create the actual native object.
 */
export let isInstantiating = false;

/**
 * Sets the instantiation flag.
 * @param value - The new value for the instantiation flag.
 */
export const setInstantiating = (value: boolean): void => {
    isInstantiating = value;
};

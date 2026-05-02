import type { NativeHandle } from "@gtkx/native";

export type { NativeHandle } from "@gtkx/native";

/**
 * Base class for all GLib/GTK native objects managed by the FFI layer.
 *
 * Every generated binding (GObject, boxed type, interface, etc.) extends
 * this class, which holds the raw native handle used for FFI calls.
 */
export abstract class NativeObject {
    static readonly glibTypeName: string;
    static readonly objectType: "gobject" | "interface" | "boxed" | "struct" | "fundamental";
    handle: NativeHandle;

    constructor(handle: NativeHandle) {
        this.handle = handle;
    }
}

/**
 * Constructor type for a {@link NativeObject} subclass, carrying GLib type
 * metadata (`glibTypeName`, `objectType`) as static properties.
 */
export type NativeClass<T extends NativeObject = NativeObject> = (new (
    // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant constructor type compatibility
    ...args: any[]
) => T) & {
    readonly glibTypeName: string;
    readonly objectType: "gobject" | "interface" | "boxed" | "struct" | "fundamental";
};

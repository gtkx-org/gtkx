import type { NativeHandle } from "@gtkx/native";
import type { GType } from "./generated/gobject/gobject.js";

export type { NativeHandle } from "@gtkx/native";

/**
 * Structural shape of any wrapped native instance once construction or
 * `wrapHandle` has stamped its runtime GLib type onto it. Every GObject and
 * boxed wrapper produced by `@gtkx/ffi` satisfies this interface; consumers
 * that need the runtime `GType` of an instance read it through this type.
 */
export interface GTypeStamped {
    /** Runtime GType of the underlying GObject or boxed instance. */
    __gtype__: GType;
}

/**
 * Internal abstract base for hand-written `@gtkx/ffi` native wrappers such as
 * the cairo `Matrix`. Generated wrapper classes do not extend it — they emit
 * their own constructor that delegates to `constructNativeObject`. Also the
 * wrapper type threaded through the identity registry. Not exported from the
 * public `@gtkx/ffi` surface.
 */
export abstract class NativeObject implements GTypeStamped {
    /** Runtime GType of the underlying GObject or boxed instance. */
    declare __gtype__: GType;
}

/**
 * Constructor type for a generated native wrapper class. Used as the key type
 * of the construction-metadata registry and accepted by the wrapper-resolution
 * helpers (`getNativeObject`, `registerNativeClass`).
 */
export type NativeClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    readonly prototype: T;
};

/**
 * Returns the superclass of a native wrapper class, or `null` when `cls` is a
 * root class whose prototype is `Function.prototype` (the JavaScript class
 * hierarchy root). Encapsulates the single boundary where a prototype-chain
 * walk over generated classes meets the untyped function root, so callers can
 * iterate ancestry without comparing against `Function.prototype` themselves.
 */
export function getParentClass(cls: NativeClass): NativeClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as NativeClass) : null;
}

const handleMap = new WeakMap<object, NativeHandle>();

/**
 * Returns the native handle associated with `obj`. Throws when the object
 * has not been linked to a handle.
 *
 */
export function getHandle(obj: object): NativeHandle {
    const handle = handleMap.get(obj);
    if (handle === undefined) {
        const name = (obj as { constructor?: { name?: string } }).constructor?.name ?? "object";
        throw new Error(`No native handle associated with ${name}`);
    }
    return handle;
}

/**
 * Returns the native handle associated with `obj`, or `undefined` when the
 * object is nullish or has not been linked to a handle. Use this when a
 * caller cannot guarantee that the object has been fully constructed.
 *
 */
export function tryGetHandle(obj: object | null | undefined): NativeHandle | undefined {
    return obj == null ? undefined : handleMap.get(obj);
}

/**
 * Associates a native handle with `obj`.
 *
 */
export function setHandle(obj: object, handle: NativeHandle): void {
    handleMap.set(obj, handle);
}

/**
 * Registry of generated class-struct vtable descriptors, keyed by the JS class
 * they belong to. Populated by codegen at module load via {@link setClassStruct}
 * and consulted by `registerClass` to auto-discover vfunc overrides supplied
 * as plain methods on user subclasses.
 */
type ClassStructDescriptors = Readonly<Record<string, unknown>>;

const classStructMap = new WeakMap<object, ClassStructDescriptors>();

/**
 * Associates a class-struct vfunc registry with a generated class so that
 * `registerClass` can resolve vfunc overrides by method name on subclasses.
 *
 */
export function setClassStruct(cls: object, descriptors: ClassStructDescriptors): void {
    classStructMap.set(cls, descriptors);
}

/**
 * Resolves the class-struct vfunc descriptor map associated with `cls`, or
 * `undefined` when no descriptors have been registered for it.
 */
export function getClassStruct(cls: object): ClassStructDescriptors | undefined {
    return classStructMap.get(cls);
}

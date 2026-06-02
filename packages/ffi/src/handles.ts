import type { NativeHandle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import type { GType } from "./gtype.js";

export type { NativeHandle } from "@gtkx/native";

/**
 * Structural shape of any wrapped native instance once construction or
 * `wrapHandle` has stamped its runtime GLib type onto it. Every GObject and
 * boxed wrapper produced by `@gtkx/ffi` satisfies this interface; consumers
 * that need the runtime `GType` of an instance read it through this type.
 */
export interface GTyped {
    /** Runtime GType of the underlying GObject or boxed instance. */
    __gtype__: GType;
}

/**
 * Returns the superclass of a native wrapper class, or `null` when `cls` is a
 * root class whose prototype is `Function.prototype` (the JavaScript class
 * hierarchy root). Encapsulates the single boundary where a prototype-chain
 * walk over generated classes meets the untyped function root, so callers can
 * iterate ancestry without comparing against `Function.prototype` themselves.
 */
export function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
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
 * Registry of generated vtable vfunc descriptors, keyed by the JS class they
 * belong to. Populated by codegen at module load via {@link registerClassVfuncMetadata}
 * and consulted by `registerClass` to auto-discover vfunc overrides supplied
 * as plain methods on user subclasses.
 */
export type ClassVfuncMetadata = Readonly<Record<string, unknown>>;

const classVfuncMetadataMap = new WeakMap<object, ClassVfuncMetadata>();

/**
 * Associates a vtable vfunc descriptor registry with a generated class so that
 * `registerClass` can resolve vfunc overrides by method name on subclasses.
 *
 */
export function registerClassVfuncMetadata(cls: object, metadata: ClassVfuncMetadata): void {
    classVfuncMetadataMap.set(cls, metadata);
}

/**
 * Resolves the vtable vfunc descriptor map associated with `cls`, or
 * `undefined` when no descriptors have been registered for it.
 */
export function getClassVfuncMetadata(cls: object): ClassVfuncMetadata | undefined {
    return classVfuncMetadataMap.get(cls);
}

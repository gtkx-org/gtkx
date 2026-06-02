/**
 * Unified module-load registration entry point for generated FFI bindings.
 *
 * Every generated wrapper type — GObject class, interface, or boxed record —
 * registers itself with a single {@link registerNativeClass} call carrying one
 * descriptor. The descriptor bundles the runtime `GType`, construction
 * metadata, and vtable vfunc descriptors; this module resolves the shared
 * `GType` once and fans the pieces out to the individual runtime registries.
 */

import type { AnyClass } from "@gtkx/utils";
import { G_TYPE_INVALID, type GType } from "./gtype.js";
import { registerVfuncRegistry, type VfuncRegistry } from "./handles.js";
import { registerInterfaceVfuncRegistry } from "./register-class.js";
import { setClassGType, setInterfaceGType } from "./registry.js";

/**
 * The kind of native type being registered, selecting which identity registry
 * the resolved `GType` lands in and whether vtable descriptors also register an
 * interface vfunc mapping.
 */
type NativeClassRole = "class" | "interface" | "boxed";

/**
 * Everything {@link registerNativeClass} needs to register one native type.
 *
 * All fields beyond `role` are optional: a boxed record without a `GType`
 * omits `gtype`, and a type with no overridable vtable slots omits `vfuncs`.
 */
export type NativeClassDescriptor = {
    /** Whether the type is a class, an interface, or a boxed record. */
    readonly role: NativeClassRole;
    /**
     * Resolves the runtime `GType`. Invoked exactly once at registration; the
     * resolved value is shared across every registry. Typed loosely because
     * generated bindings expose `t.fn(...)` closures whose return type is
     * broader than `number`.
     */
    readonly gtype?: () => unknown;
    /** Overridable vtable slot descriptors, absent when none are marshallable. */
    readonly vfuncs?: VfuncRegistry;
};

/**
 * Registers a generated native type from a single descriptor.
 *
 * Called automatically by generated bindings, once per type at module load.
 * Resolves the descriptor's `GType` a single time and records it in the
 * appropriate identity registry, then registers any vfunc metadata the
 * descriptor carries.
 *
 * @param cls - The generated wrapper class
 * @param descriptor - The bundled registration metadata
 */
export function registerNativeClass(cls: AnyClass, descriptor: NativeClassDescriptor): void {
    const gtype: GType = descriptor.gtype ? Number(descriptor.gtype()) : G_TYPE_INVALID;

    if (descriptor.role === "interface") {
        setInterfaceGType(cls, gtype);
    } else {
        setClassGType(cls, gtype);
    }

    if (descriptor.vfuncs) {
        registerVfuncRegistry(cls, descriptor.vfuncs);
        if (descriptor.role === "interface") {
            registerInterfaceVfuncRegistry(gtype, descriptor.vfuncs);
        }
    }
}

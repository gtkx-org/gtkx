/**
 * Unified module-load registration entry point for generated FFI bindings.
 *
 * Every generated wrapper type — GObject class, interface, or boxed record —
 * registers itself with a single {@link registerWrapperClass} call into the one
 * identity registry, keyed by its `GType`. Interface and concrete `GType`s share
 * that registry because their key spaces are disjoint; interface-ness is
 * determined at resolution time from the GObject type system, not recorded here.
 */

import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INTERFACE, typeFundamental } from "./gtype.js";
import { registerInterfaceVfuncRegistry } from "./register-class.js";
import { registerVfuncRegistry, setClassGtype, type VfuncRegistry } from "./registry.js";

/**
 * Registers a generated wrapper type from its runtime `GType`.
 *
 * Called automatically by generated bindings, once per type at module load. The
 * class is recorded under its `GType` regardless of kind. The `vfuncs` map, when
 * present, registers the type's overridable vtable slots; for an interface
 * `GType` (one whose fundamental is `G_TYPE_INTERFACE`) it additionally registers
 * the interface vtable so user subclasses can implement it.
 *
 * @param cls - The generated wrapper class
 * @param gtype - The runtime `GType` of the wrapper type
 * @param vfuncs - Overridable vtable slot descriptors, when the type has any
 */
export function registerWrapperClass(cls: AnyClass, gtype: GType, vfuncs?: VfuncRegistry): void {
    setClassGtype(cls, gtype);
    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
        if (typeFundamental(gtype) === TYPE_INTERFACE) {
            registerInterfaceVfuncRegistry(gtype, vfuncs);
        }
    }
}

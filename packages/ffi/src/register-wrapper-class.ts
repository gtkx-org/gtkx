/**
 * Unified module-load registration entry point for generated FFI bindings.
 *
 * Every generated wrapper type — GObject class, interface, or boxed record —
 * registers itself with a single {@link registerWrapperClass} call. The kind of
 * registration is derived from the runtime `GType` it passes: an interface
 * `GType` (one whose fundamental is `G_TYPE_INTERFACE`) records an interface
 * mapping, every other `GType` records a class mapping.
 */

import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INTERFACE, typeFundamental } from "./gtype.js";
import { registerInterfaceVfuncRegistry } from "./register-class.js";
import { registerVfuncRegistry, setClassGtype, setInterfaceGtype, type VfuncRegistry } from "./registry.js";

/**
 * Registers a generated wrapper type from its runtime `GType`.
 *
 * Called automatically by generated bindings, once per type at module load.
 * Whether the `GType` is an interface is read from its fundamental type, so the
 * caller passes no separate role: an interface `GType` records an interface
 * mapping (and, with `vfuncs`, an interface vfunc registry); any other `GType`
 * records a class mapping. The `vfuncs` map, when present, registers the type's
 * overridable vtable slots.
 *
 * @param cls - The generated wrapper class
 * @param gtype - The runtime `GType` of the wrapper type
 * @param vfuncs - Overridable vtable slot descriptors, when the type has any
 */
export function registerWrapperClass(cls: AnyClass, gtype: GType, vfuncs?: VfuncRegistry): void {
    if (typeFundamental(gtype) === TYPE_INTERFACE) {
        setInterfaceGtype(cls, gtype);
        if (vfuncs) {
            registerVfuncRegistry(cls, vfuncs);
            registerInterfaceVfuncRegistry(gtype, vfuncs);
        }
        return;
    }

    setClassGtype(cls, gtype);
    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
    }
}

import { type AnyClass, type WrapperClass } from "@gtkx/runtime";
import { peekTypeClass } from "@gtkx/runtime/internal";
import { ObjectClass as GeneratedObjectClass } from "../gobject.js";

const peek = (type: bigint | AnyClass): ObjectClass => peekTypeClass(type) as ObjectClass;

/**
 * The class structure for the GObject type, with a static `peek` that hands back the class struct
 * of any GObject type so class-level introspection such as `findProperty` and `listProperties`
 * works outside a `classInit` hook.
 */
export const ObjectClass: WrapperClass<typeof GeneratedObjectClass, ObjectClass> & {
    /**
     * Returns the class struct of a GObject type, referencing the class so it exists even before
     * the type's first instance. The reference is deliberately never released: once created, a
     * class struct lives for the rest of the process.
     *
     * @param type GType to peek the class struct of, or a registered wrapper class of the type.
     * @returns the type's class struct
     * @throws when `type` is not a GObject type
     */
    peek: typeof peek;
} = Object.assign(GeneratedObjectClass, { peek });

/**
 * The class structure for the GObject type.
 */
export interface ObjectClass extends GeneratedObjectClass {}

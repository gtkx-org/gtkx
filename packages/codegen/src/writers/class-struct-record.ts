import type { ModuleContext } from "../dsl/context.js";
import type { GirBoxed } from "../gir/boxed.js";
import type { GirFunction } from "../gir/function.js";
import type { GirRepository } from "../gir/repository.js";
import type { TypeId } from "../gir/type-id.js";

/**
 * GObject's class- and interface-struct roots. Every concrete class struct
 * (`GEnumClass`, `GFlagsClass`, …) embeds one of these as its first field; the
 * roots themselves open with a bare `GType` and are matched by name.
 */
const GTYPE_STRUCT_ROOTS = new Set(["GObject.TypeClass", "GObject.TypeInterface"]);

/**
 * Class/interface-struct records that carry no embedded `GTypeClass`/
 * `GTypeInterface` marker and therefore have to be named outright.
 */
const EXPLICIT_CLASS_STRUCTS = new Set(["Pango.AttrClass"]);

const qualify = (namespaceName: string, name: string): string => `${namespaceName}.${name}`;

/**
 * Reports whether a `<record>` is a GObject class- or interface-struct — the
 * runtime vtable of a type rather than a marshallable value. These are never
 * constructed or passed by value from JavaScript, so codegen emits neither the
 * record nor any binding that references it.
 *
 * @param repository - The GIR repository, to name the first field's type
 * @param namespaceName - The namespace the record lives in
 * @param boxed - The record under consideration
 */
export const isClassStructRecord = (repository: GirRepository, namespaceName: string, boxed: GirBoxed): boolean => {
    const qualified = qualify(namespaceName, boxed.name);
    if (GTYPE_STRUCT_ROOTS.has(qualified) || EXPLICIT_CLASS_STRUCTS.has(qualified)) return true;
    const first = boxed.fields[0];
    if (first === undefined || first.type === undefined) return false;
    const name = repository.nameOf(first.type);
    if (name === undefined) return false;
    return GTYPE_STRUCT_ROOTS.has(qualify(name.namespaceName, name.typeName));
};

const refIsClassStruct = (context: ModuleContext, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = context.repository.typeOf(ref);
    if (type === undefined) return false;
    switch (type.kind) {
        case "boxed":
            return isClassStructRecord(context.repository, type.namespace.name, type.value);
        case "carray":
        case "list":
            return refIsClassStruct(context, type.element);
        default:
            return false;
    }
};

/**
 * Reports whether a type reference resolves to a class/interface-struct record,
 * following array and list element types.
 *
 * @param context - The module context
 * @param ref - The interned type slot, or `undefined`
 */
export const typeRefIsClassStruct = (context: ModuleContext, ref: TypeId | undefined): boolean =>
    refIsClassStruct(context, ref);

/**
 * Reports whether a callable's return type or any parameter resolves to a
 * class/interface-struct record, so its binding and wrapper can be dropped.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const callableReferencesClassStruct = (context: ModuleContext, fn: GirFunction): boolean =>
    refIsClassStruct(context, fn.returnValue.type) ||
    fn.parameters.some((parameter) => refIsClassStruct(context, parameter.type));

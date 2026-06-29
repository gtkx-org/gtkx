import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";

const GTYPE_STRUCT_ROOTS = new Set(["GObject.TypeClass", "GObject.TypeInterface"]);

const EXPLICIT_CLASS_STRUCTS = new Set(["Pango.AttrClass"]);

const qualify = (namespaceName: string, name: string): string => `${namespaceName}.${name}`;

export const isClassStructRecord = (library: Library, namespaceName: string, record: GirRecord): boolean => {
    const qualified = qualify(namespaceName, record.name);
    if (GTYPE_STRUCT_ROOTS.has(qualified) || EXPLICIT_CLASS_STRUCTS.has(qualified)) return true;
    const first = record.fields[0];
    if (first === undefined || first.type === undefined) return false;
    const name = library.nameOf(first.type);
    if (name === undefined) return false;
    return GTYPE_STRUCT_ROOTS.has(qualify(name.namespaceName, name.typeName));
};

export const refIsClassStruct = (context: ModuleContext, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = context.library.typeOf(ref);
    if (type === undefined) return false;
    switch (type.kind) {
        case "record":
            return isClassStructRecord(context.library, type.namespace.name, type.value);
        case "carray":
        case "list":
            return refIsClassStruct(context, type.element);
        default:
            return false;
    }
};

export const callableReferencesClassStruct = (context: ModuleContext, fn: GirFunction): boolean =>
    refIsClassStruct(context, fn.returnValue.type) ||
    fn.parameters.some((parameter) => refIsClassStruct(context, parameter.type));

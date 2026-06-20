import type { ModuleContext } from "../dsl/context.js";
import type { GirBoxed } from "../gir/boxed.js";
import type { GirFunction } from "../gir/function.js";
import type { GirRepository } from "../gir/repository.js";
import type { TypeId } from "../gir/type-id.js";

const GTYPE_STRUCT_ROOTS = new Set(["GObject.TypeClass", "GObject.TypeInterface"]);

const EXPLICIT_CLASS_STRUCTS = new Set(["Pango.AttrClass"]);

const qualify = (namespaceName: string, name: string): string => `${namespaceName}.${name}`;

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

export const typeRefIsClassStruct = (context: ModuleContext, ref: TypeId | undefined): boolean =>
    refIsClassStruct(context, ref);

export const callableReferencesClassStruct = (context: ModuleContext, fn: GirFunction): boolean =>
    refIsClassStruct(context, fn.returnValue.type) ||
    fn.parameters.some((parameter) => refIsClassStruct(context, parameter.type));

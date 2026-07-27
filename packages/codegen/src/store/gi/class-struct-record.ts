import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";

const TYPE_STRUCT_ROOTS = new Set(["GObject.TypeClass", "GObject.TypeInterface"]);
const EXPLICIT_CLASS_STRUCTS = new Set(["Pango.AttrClass"]);

const qualify = (namespaceName: string, name: string): string => `${namespaceName}.${name}`;

const isClassStructRecord = (library: Library, namespaceName: string, record: GirRecord): boolean => {
    const qualified = qualify(namespaceName, record.name);

    if (TYPE_STRUCT_ROOTS.has(qualified) || EXPLICIT_CLASS_STRUCTS.has(qualified)) {
        return true;
    }

    const first = record.fields[0];

    // A class struct embeds its parent vtable by value (`GTypeClass g_type_class`); an instance
    // struct stores a pointer to it (`GTypeClass *g_class`). Only the first is a vtable.
    if (first?.type === undefined || first.cType?.endsWith("*") === true) {
        return false;
    }

    const name = library.nameFor(first.type);

    if (name === undefined) {
        return false;
    }

    return TYPE_STRUCT_ROOTS.has(qualify(name.namespaceName, name.typeName));
};

const isClassStructRef = (context: ModuleContext, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return false;
    }

    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return false;
    }

    switch (type.kind) {
        case "record": {
            return isClassStructRecord(context.library, type.namespace.name, type.value);
        }
        case "carray":
        case "list": {
            return isClassStructRef(context, type.element);
        }
        case "alias":
        case "callback":
        case "class":
        case "enum":
        case "hashtable":
        case "interface":
        case "primitive":
        case "varargs": {
            return false;
        }
    }
};

const hasClassStructReference = (context: ModuleContext, fn: GirFunction): boolean =>
    isClassStructRef(context, fn.returnValue.type) ||
    fn.parameters.some((parameter) => isClassStructRef(context, parameter.type));

export { isClassStructRecord, isClassStructRef, hasClassStructReference };

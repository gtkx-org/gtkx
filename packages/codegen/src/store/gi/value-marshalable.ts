import type { GirField } from "../../gir/field.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";

type Scope = { context: ModuleContext; seen: Set<string> };

/** Primitive categories that are a pointer at the C level, so copying the bytes aliases the pointee. */
const POINTER_CATEGORIES: Set<PrimitiveCategory> = new Set<PrimitiveCategory>(["string", "pointer"]);

const recordKey = (namespaceName: string, record: GirRecord): string => `${namespaceName}.${record.name}`;

const hasOwnCopySemantics = (record: GirRecord): boolean =>
    record.glibGetType !== undefined ||
    ((record.glibRefFunc ?? record.copyFunc) !== undefined && (record.glibUnrefFunc ?? record.freeFunc) !== undefined);

const isValueSafeArray = (scope: Scope, type: Extract<GirType, { kind: "carray" }>): boolean =>
    type.fixedSize !== undefined && isValueSafeRef(scope, type.element, type.elementCType);

const isValueSafeAlias = (scope: Scope, type: Extract<GirType, { kind: "alias" }>): boolean =>
    isValueSafeRef(scope, type.value.target, type.value.targetCType);

function isValueSafeType(scope: Scope, type: GirType): boolean {
    switch (type.kind) {
        case "primitive": {
            return !POINTER_CATEGORIES.has(type.category);
        }
        case "enum": {
            return true;
        }
        case "record": {
            return isValueSafeRecord(scope, type.namespace.name, type.value);
        }
        case "carray": {
            return isValueSafeArray(scope, type);
        }
        case "alias": {
            return isValueSafeAlias(scope, type);
        }
        case "callback":
        case "class":
        case "hashtable":
        case "interface":
        case "list":
        case "varargs": {
            return false;
        }
    }
}

function isValueSafeRef(scope: Scope, ref: TypeId | undefined, cType: string | undefined): boolean {
    if (ref === undefined || cType?.endsWith("*") === true) {
        return false;
    }

    const type = scope.context.library.typeFor(ref);

    return type === undefined ? false : isValueSafeType(scope, type);
}

const isValueSafeField = (scope: Scope, field: GirField): boolean =>
    field.inlineMembers === undefined
        ? isValueSafeRef(scope, field.type, field.cType)
        : field.inlineMembers.every((member) => isValueSafeField(scope, member));

function isValueSafeRecord(scope: Scope, namespaceName: string, record: GirRecord): boolean {
    const key = recordKey(namespaceName, record);

    if (scope.seen.has(key) || record.fields.length === 0) {
        return false;
    }

    scope.seen.add(key);

    return record.fields.every((field) => isValueSafeField(scope, field));
}

/**
 * Whether a record can be copied by value. A plain struct is duplicated with a byte-wise `g_memdup2`,
 * which shallow-copies whatever the bytes hold, so only a record whose every field is transitively a
 * scalar can be owned, allocated or written into an inline slot. A pointer, a string, a function
 * pointer or an opaque record makes it borrow-only. Records that carry their own copy/free pair are
 * duplicated through that instead and never reach the byte-wise path.
 */
const isValueMarshalable = (context: ModuleContext, namespaceName: string, record: GirRecord): boolean =>
    isValueSafeRecord({ context, seen: new Set<string>() }, namespaceName, record);

/** Whether a record can be allocated and populated from JavaScript. */
const isConstructibleRecord = (context: ModuleContext, namespaceName: string, record: GirRecord): boolean =>
    hasOwnCopySemantics(record) || isValueMarshalable(context, namespaceName, record);

export { hasOwnCopySemantics, isConstructibleRecord, isValueMarshalable };

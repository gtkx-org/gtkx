import type { GirField } from "../../gir/field.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";

type Scope = { context: ModuleContext; seen: Set<string> };

const recordKey = (namespaceName: string, record: GirRecord): string => `${namespaceName}.${record.name}`;
const isPointerCType = (cType: string | undefined): boolean => cType?.endsWith("*") === true;

const isSimpleArrayElement = (scope: Scope, type: Extract<GirType, { kind: "carray" }>): boolean =>
    isSimpleRef(scope, type.element, type.elementCType);

const isSimplePointerType = (scope: Scope, type: GirType): boolean =>
    type.kind === "carray" ? isSimpleArrayElement(scope, type) : true;

const isSimpleArray = (scope: Scope, type: Extract<GirType, { kind: "carray" }>): boolean => {
    if (type.fixedSize === undefined || isPointerCType(type.arrayCType)) {
        return isSimpleArrayElement(scope, type);
    }

    return true;
};

function isSimpleType(scope: Scope, type: GirType, occurrenceCType: string | undefined): boolean {
    if (isPointerCType(occurrenceCType)) {
        return isSimplePointerType(scope, type);
    }

    switch (type.kind) {
        case "primitive":
        case "enum": {
            return true;
        }
        case "record": {
            return isSimpleRecord(scope, type.namespace.name, type.value);
        }
        case "alias": {
            return isSimpleRef(scope, type.value.target, type.value.targetCType);
        }
        case "carray": {
            return isSimpleArray(scope, type);
        }
        case "callback":
        case "class":
        case "hashtable":
        case "interface":
        case "list": {
            return true;
        }
        case "varargs": {
            return false;
        }
    }
}

function isSimpleRef(scope: Scope, ref: TypeId | undefined, cType: string | undefined): boolean {
    if (ref === undefined) {
        return false;
    }

    const type = scope.context.library.typeFor(ref);

    return type === undefined ? isPointerCType(cType) : isSimpleType(scope, type, cType);
}

const isSimpleField = (scope: Scope, field: GirField): boolean => {
    if (field.inlineMembers === undefined) {
        return isSimpleRef(scope, field.type, field.cType);
    }

    return field.inlineMembers.length > 0 && field.inlineMembers.every((member) => isSimpleField(scope, member));
};

function isSimpleRecord(scope: Scope, namespaceName: string, record: GirRecord): boolean {
    const key = recordKey(namespaceName, record);

    if (record.opaque || record.disguised || record.fields.length === 0 || scope.seen.has(key)) {
        return false;
    }

    scope.seen.add(key);
    const isSimple = record.fields.every((field) => isSimpleField(scope, field));
    scope.seen.delete(key);

    return isSimple;
}

const isGjsSimpleRecord = (context: ModuleContext, namespaceName: string, record: GirRecord): boolean =>
    isSimpleRecord({ context, seen: new Set<string>() }, namespaceName, record);

export { isGjsSimpleRecord };

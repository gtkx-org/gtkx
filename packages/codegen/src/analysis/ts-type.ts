import type { Library } from "../gir/library.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";
import { isClassStructRecord } from "../store/gi/class-struct-record.js";
import { gtypeTsType } from "../store/gi/gtype-binding.js";
import type { ModuleContext } from "../writer/context.js";

type ReferenceName = {
    namespaceName: string;
    typeName: string;
};

export type TsTypeTarget = {
    containerStyle: "map" | "record";
    callbackType: string;
    byteArrayAsNumber: boolean;
    renderNamed: (resolved: GirType | undefined, name: ReferenceName) => string;
    renderGtype: () => string;
};

const willEmitEntity = (library: Library, type: EntityType): boolean => {
    switch (type.kind) {
        case "callback":
            return type.value.introspectable && type.value.name.length > 0;
        case "record":
            return (
                type.value.introspectable &&
                !type.value.isVtable &&
                type.value.name.length > 0 &&
                !isClassStructRecord(library, type.namespace.name, type.value)
            );
        default:
            return true;
    }
};

export const renderBaseTypeFor = (library: Library, target: TsTypeTarget, ref: TypeId | undefined): string => {
    if (ref === undefined) return "void";
    const type = library.typeOf(ref);
    const name = library.nameOf(ref);
    if (type === undefined) return renderNamedType(target, undefined, name);
    switch (type.kind) {
        case "primitive":
            return type.category === "gtype" ? target.renderGtype() : PRIMITIVE_TS_TYPE[type.category];
        case "varargs":
            return "unknown[]";
        case "callback":
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias":
            return renderNamedType(target, type, willEmitEntity(library, type) ? name : undefined);
        case "carray":
            return `${renderBaseTypeFor(library, target, type.element)}[]`;
        case "list":
            if (type.flavor === "gbytearray" && target.byteArrayAsNumber) return "number[]";
            return `${renderBaseTypeFor(library, target, type.element)}[]`;
        case "hashtable": {
            const key = renderBaseTypeFor(library, target, type.key);
            const value = renderBaseTypeFor(library, target, type.value);
            return target.containerStyle === "record" ? `Record<${key}, ${value}>` : `Map<${key}, ${value}>`;
        }
    }
};

const renderNamedType = (
    target: TsTypeTarget,
    resolved: GirType | undefined,
    name: ReferenceName | undefined,
): string => {
    if (name === undefined) return resolved?.kind === "callback" ? target.callbackType : "unknown";
    return target.renderNamed(resolved, name);
};

const moduleTarget = (context: ModuleContext): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    byteArrayAsNumber: true,
    renderNamed: (_resolved, name) => context.qualify(name.namespaceName, name.typeName),
    renderGtype: () => gtypeTsType(context),
});

export const renderTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable = false): string => {
    const base = renderBaseTypeFor(context.library, moduleTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};

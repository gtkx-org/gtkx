import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { Library } from "../gir/library.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import { isEmittableEntity } from "../gir/emittable.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import {
    type CArrayType,
    type HashTableType,
    hasUnknownArrayLength,
    type ListType,
    type TypeId,
} from "../gir/type-id.js";
import { gtypeTsType } from "../store/gi/gtype-binding.js";

type ReferenceName = {
    namespaceName: string;
    typeName: string;
};

type TsTypeTarget = {
    containerStyle: "map" | "record";
    callbackType: string;
    shouldRenderByteArrayAsNumber: boolean;
    renderNamed: (resolved: GirType | undefined, name: ReferenceName) => string;
    renderGtype: () => string;
};

const willEmitEntity = (type: EntityType): boolean => isEmittableEntity(type.value);

const referenceName = (library: Library, ref: TypeId): ReferenceName | undefined => {
    const name = library.nameFor(ref);

    return name === undefined
        ? undefined
        : { namespaceName: name.namespaceName, typeName: sanitizeTypeIdentifier(name.typeName) };
};

const renderPrimitiveType = (target: TsTypeTarget, type: Extract<GirType, { kind: "primitive" }>): string =>
    type.category === "gtype" ? target.renderGtype() : PRIMITIVE_TS_TYPE[type.category];

const renderEntityType = (
    target: TsTypeTarget,
    type: EntityType,
    name: ReferenceName | undefined,
): string => renderNamedType(target, type, willEmitEntity(type) ? name : undefined);

const renderBaseType = (library: Library, target: TsTypeTarget, ref: TypeId | undefined): string => {
    if (ref === undefined) {
        return "void";
    }

    const type = library.typeFor(ref);

    if (type === undefined) {
        return renderNamedType(target, undefined, undefined);
    }

    const name = referenceName(library, ref);

    switch (type.kind) {
        case "primitive": {
            return renderPrimitiveType(target, type);
        }
        case "varargs": {
            return "unknown[]";
        }
        case "callback":
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias": {
            return renderEntityType(target, type, name);
        }
        case "carray":
        case "list":
        case "hashtable": {
            return renderContainerType(library, target, type);
        }
    }
};

const renderContainerType = (
    library: Library,
    target: TsTypeTarget,
    type: CArrayType | ListType | HashTableType,
): string => {
    if (type.kind === "hashtable") {
        const key = renderBaseType(library, target, type.key);
        const value = renderBaseType(library, target, type.value);

        return target.containerStyle === "record" ? `Record<${key}, ${value}>` : `Map<${key}, ${value}>`;
    }

    return renderSequenceType(library, target, type);
};

const renderSequenceType = (library: Library, target: TsTypeTarget, type: CArrayType | ListType): string => {
    if (type.kind === "list" && type.flavor === "gbytearray" && target.shouldRenderByteArrayAsNumber) {
        return "number[]";
    }

    if (type.kind === "carray" && hasUnknownArrayLength(type)) {
        return "number";
    }

    return `${renderBaseType(library, target, type.element)}[]`;
};

const renderNamedType = (
    target: TsTypeTarget,
    resolved: GirType | undefined,
    name: ReferenceName | undefined,
): string => {
    if (name === undefined || name.typeName.length === 0) {
        return resolved?.kind === "callback" ? target.callbackType : "unknown";
    }

    return target.renderNamed(resolved, name);
};

const moduleTarget = (context: ModuleContext): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    shouldRenderByteArrayAsNumber: true,
    renderNamed: (_resolved, name) => context.qualify(name.namespaceName, name.typeName),
    renderGtype: () => gtypeTsType(context),
});

const renderTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable = false): string => {
    const base = renderBaseType(context.library, moduleTarget(context), ref);

    return isNullable ? `${base} | null` : base;
};

const recordTypeTarget = (
    library: Library,
    renderNamedRef: (name: ReferenceName) => string,
    renderGtype: () => string,
): TsTypeTarget => {
    const target: TsTypeTarget = {
        containerStyle: "record",
        callbackType: "((...args: unknown[]) => unknown)",
        shouldRenderByteArrayAsNumber: false,
        renderNamed: (resolved, name) => {
            if (resolved?.kind === "alias") {
                return resolved.value.target === undefined
                    ? "number"
                    : renderBaseType(library, target, resolved.value.target);
            }

            return renderNamedRef(name);
        },
        renderGtype,
    };

    return target;
};

export { renderBaseType, renderTsType, recordTypeTarget, type TsTypeTarget };

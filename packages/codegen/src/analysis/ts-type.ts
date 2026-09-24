import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
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
import { gtypeParamTsType, gtypeTsType } from "../store/gi/gtype-binding.js";
import { isValueTypeName } from "../store/gi/param-marshal.js";
import { isByteSequence, primitiveCategoryThroughAliases } from "./type-shape.js";

type ReferenceName = {
    namespaceName: string;
    typeName: string;
};

type TsTypeTarget = {
    containerStyle: "map" | "record";
    callbackType: string;
    byteArrayType: string;
    isInput: boolean;
    canAcceptTypedArrayViews: boolean;
    renderNamed: (resolved: GirType | undefined, name: ReferenceName) => string;
    renderGtype: () => string;
};

type ModuleTypeOptions = {
    byteArrayType: string;
    isValueWidened: boolean;
    isGtypeWidened: boolean;
    isInput: boolean;
    canAcceptTypedArrayViews: boolean;
};

type ParameterTsTypeOptions = {
    isNullable?: boolean;
    isValueWidened?: boolean;
    canAcceptTypedArrayViews?: boolean;
};

type RecordTypeTargetOptions = {
    isInput?: boolean;
    canAcceptTypedArrayViews?: boolean;
};

const BYTE_ARRAY_TYPE = "Uint8Array";
const BYTE_ARRAY_INPUT_TYPE = "Uint8Array | Uint8ClampedArray | number[]";
const TYPED_ARRAY_INPUT_TYPES: Partial<Record<PrimitiveCategory, string>> = {
    int8: "Int8Array",
    uint8: "Uint8Array | Uint8ClampedArray",
    int16: "Int16Array",
    uint16: "Uint16Array",
    int32: "Int32Array",
    uint32: "Uint32Array",
    int64: "BigInt64Array",
    uint64: "BigUint64Array",
    bigint64: "BigInt64Array",
    biguint64: "BigUint64Array",
    gtype: "BigUint64Array",
    float32: "Float32Array",
    float64: "Float64Array",
    unichar: "Uint32Array",
};
const NUMBER_INPUT_CATEGORIES: Set<PrimitiveCategory> = new Set(["bigint64", "biguint64", "unichar"]);

const willEmitEntity = (type: EntityType): boolean => isEmittableEntity(type.value);

const referenceName = (library: Library, ref: TypeId): ReferenceName | undefined => {
    const name = library.nameFor(ref);

    return name === undefined
        ? undefined
        : { namespaceName: name.namespaceName, typeName: sanitizeTypeIdentifier(name.typeName) };
};

const renderPrimitiveType = (target: TsTypeTarget, type: Extract<GirType, { kind: "primitive" }>): string => {
    if (type.category === "gtype") {
        return target.renderGtype();
    }

    const rendered = PRIMITIVE_TS_TYPE[type.category];

    if (!target.isInput) {
        return rendered;
    }

    if (type.category === "bigint64" || type.category === "biguint64") {
        return `${rendered} | number`;
    }

    return type.category === "unichar" ? `${rendered} | number` : rendered;
};

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

const parenthesizeUnion = (rendered: string): string => (rendered.includes(" | ") ? `(${rendered})` : rendered);

const renderByteSequenceType = (target: TsTypeTarget, type: CArrayType | ListType): string =>
    target.isInput && type.kind === "carray" && !target.canAcceptTypedArrayViews
        ? "number[]"
        : target.byteArrayType;

const directTypedArrayInputType = (type: GirType): string | undefined => {
    if (type.kind === "enum") {
        return type.value.members.some((member) => member.value.startsWith("-")) ? "Int32Array" : "Uint32Array";
    }

    return type.kind === "primitive" ? TYPED_ARRAY_INPUT_TYPES[type.category] : undefined;
};

const typedArrayInputType = (library: Library, ref: TypeId): string | undefined => {
    const type = library.typeFor(ref);

    if (type === undefined) {
        return undefined;
    }

    if (type.kind !== "alias") {
        return directTypedArrayInputType(type);
    }

    return type.value.target === undefined ? undefined : typedArrayInputType(library, type.value.target);
};

const renderTypedSequenceType = (library: Library, target: TsTypeTarget, type: CArrayType | ListType): string => {
    const arrayType = `${parenthesizeUnion(renderBaseType(library, target, type.element))}[]`;

    if (type.kind !== "carray" || !target.canAcceptTypedArrayViews) {
        return arrayType;
    }

    const viewType = typedArrayInputType(library, type.element);

    return viewType === undefined ? arrayType : `${arrayType} | ${viewType}`;
};

const renderSequenceType = (library: Library, target: TsTypeTarget, type: CArrayType | ListType): string => {
    if (type.kind === "carray" && hasUnknownArrayLength(type)) {
        return "number";
    }

    if (isByteSequence(library, type)) {
        return renderByteSequenceType(target, type);
    }

    return renderTypedSequenceType(library, target, type);
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

const renderNamedModuleType = (
    context: ModuleContext,
    resolved: GirType | undefined,
    name: ReferenceName,
    options: ModuleTypeOptions,
): string => {
    const qualified = context.qualify(name.namespaceName, name.typeName);

    if (options.isValueWidened && isValueTypeName(name)) {
        context.addRuntimeTypeImport("JsValue");

        return `${qualified} | JsValue`;
    }

    const category = resolved?.kind === "alias"
        ? primitiveCategoryThroughAliases(context.library, resolved.value.target)
        : undefined;

    return category !== undefined && options.isInput && NUMBER_INPUT_CATEGORIES.has(category)
        ? `${qualified} | number`
        : qualified;
};

const moduleTarget = (context: ModuleContext, options: ModuleTypeOptions): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    byteArrayType: options.byteArrayType,
    isInput: options.isInput,
    canAcceptTypedArrayViews: options.canAcceptTypedArrayViews,
    renderNamed: (resolved, name) => renderNamedModuleType(context, resolved, name, options),
    renderGtype: () => (options.isGtypeWidened ? gtypeParamTsType(context) : gtypeTsType(context)),
});

const renderModuleType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    isNullable: boolean,
    options: ModuleTypeOptions,
): string => {
    const base = renderBaseType(context.library, moduleTarget(context, options), ref);

    return isNullable ? `${base} | null` : base;
};

const renderTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable = false): string =>
    renderModuleType(context, ref, isNullable, {
        byteArrayType: BYTE_ARRAY_TYPE,
        isValueWidened: false,
        isGtypeWidened: false,
        isInput: false,
        canAcceptTypedArrayViews: false,
    });

const renderAliasTargetTsType = (context: ModuleContext, target: TypeId | undefined): string =>
    primitiveCategoryThroughAliases(context.library, target) === "gtype"
        ? PRIMITIVE_TS_TYPE.gtype
        : renderTsType(context, target);

const renderParameterTsType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    options: ParameterTsTypeOptions = {},
): string => {
    const {
        isNullable = false,
        isValueWidened = true,
        canAcceptTypedArrayViews = true,
    } = options;

    return renderModuleType(context, ref, isNullable, {
        byteArrayType: BYTE_ARRAY_INPUT_TYPE,
        isValueWidened,
        isGtypeWidened: true,
        isInput: true,
        canAcceptTypedArrayViews,
    });
};

const recordTypeTarget = (
    library: Library,
    renderNamedRef: (name: ReferenceName) => string,
    renderGtype: () => string,
    options: RecordTypeTargetOptions = {},
): TsTypeTarget => {
    const { isInput = false, canAcceptTypedArrayViews = true } = options;
    const target: TsTypeTarget = {
        containerStyle: "record",
        callbackType: "((...args: unknown[]) => unknown)",
        byteArrayType: isInput ? BYTE_ARRAY_INPUT_TYPE : BYTE_ARRAY_TYPE,
        isInput,
        canAcceptTypedArrayViews,
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

export {
    renderAliasTargetTsType,
    renderBaseType,
    renderParameterTsType,
    renderTsType,
    recordTypeTarget,
    type TsTypeTarget,
};

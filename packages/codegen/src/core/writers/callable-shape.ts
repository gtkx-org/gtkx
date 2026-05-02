/**
 * Callable Shape
 *
 * Pre-computed plan describing how a single GIR callable
 * (method, function, or constructor) is emitted in TypeScript.
 *
 * Centralizes every per-parameter decision (signature visibility, length-hidden,
 * allocation strategy, return-tuple participation) so that the signature emitter,
 * call-arg emitter, and body emitter all operate on a single coherent plan.
 */

import type { GirParameter } from "@gtkx/gir";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType, TypeImport } from "../type-system/ffi-types.js";
import { isVararg } from "../utils/filtering.js";
import { toCamelCase, toValidIdentifier } from "../utils/naming.js";
import { isHandleBackedType } from "./call-expression-builder.js";

/**
 * A parameter that appears in the public TypeScript signature.
 */
export type SignatureParam = {
    name: string;
    tsType: string;
    /** True when the param can be omitted in the JS call (`?:`). */
    optional: boolean;
};

/**
 * Classifies how a hidden parameter should be allocated internally
 * before the FFI call and how (if at all) it contributes to the tuple.
 */
export type HiddenOutKind =
    /** Out primitive/string/array: `createRef(initial)`, expose `.value`. */
    | "ref-primitive"
    /** Inout primitive/string/array: `createRef(callerArg)`, expose `.value`. */
    | "ref-primitive-inout"
    /** Out non-caller-allocates boxed/gobject: `createRef<NativeHandle | null>(null)`, wrap pointer post-call. */
    | "ref-handle"
    /** Out caller-allocates boxed/struct: `new T()` inside the body, pass `.handle`. */
    | "alloc-struct";

/**
 * A parameter that does NOT appear in the public signature.
 *
 * Hidden outs are allocated inside the method body, threaded as FFI
 * arguments via `callArgs`, and (unless flagged as a length param)
 * surface as entries in the return tuple.
 */
export type HiddenOut = {
    /** Generated identifier for the in-body allocation. */
    varName: string;
    /** The TypeScript type the caller will see in the return tuple. */
    tsType: string;
    /** TS expression for the initial value passed to `createRef(...)`. Unused for `alloc-struct`. */
    initialValue: string;
    /** FFI descriptor used by the wire-level call argument. */
    ffi: FfiTypeDescriptor;
    /** Allocation strategy. */
    kind: HiddenOutKind;
    /** True if the outer GIR param was a length param (allocated but not surfaced). */
    isLengthParam: boolean;
    /** True if the outer GIR param was nullable (only relevant for `ref-handle`). */
    nullable: boolean;
    /** TypeScript class name to wrap the post-call handle into (`ref-handle`/`alloc-struct`). */
    wrapClassName?: string;
    /** True if `wrapClassName` refers to a boxed type (passed to getNativeObject). */
    wrapAsBoxed?: boolean;
};

/**
 * One entry in the post-call return tuple.
 */
export type ReturnTupleEntry = {
    kind: "original-return" | "out-param" | "inout-param";
    /** TypeScript type the caller will see for this slot. */
    tsType: string;
    /** True if the type is nullable. */
    nullable: boolean;
};

/**
 * A single argument passed to the FFI `call()` (excluding `self`).
 */
export type ShapeCallArg = {
    ffi: FfiTypeDescriptor;
    /** TS expression for the runtime value. */
    value: string;
    optional: boolean;
    /** Original GIR parameter (or null when synthesized for a hidden out). */
    sourceParamIndex: number | null;
};

/**
 * Per-filtered-parameter classification used by the body emitter.
 */
export type ParamMapping = {
    /** GIR parameter index (within the filtered list, post sizeParamOffset). */
    girIndex: number;
    /** JS-camelCased identifier used in the public signature (when visible). */
    jsName: string;
    /** Mapped type from FfiMapper. */
    mapped: MappedType;
    /** True if this param appears in the public signature. */
    isSignatureParam: boolean;
    /** Set when the param is hidden — points at its HiddenOut entry. */
    hiddenOutIndex: number | null;
    /** True if this is a hidden length param (not in tuple). */
    isLengthParam: boolean;
    /** True if direction is "out" or "inout". */
    isOut: boolean;
    /** True if direction is "inout". */
    isInout: boolean;
    /** True if this is a caller-allocates boxed/struct out param. */
    isCallerAllocatesStruct: boolean;
    /** True if the GIR param has nullable="1". */
    nullable: boolean;
    /** True if the GIR param has optional="1" or nullable="1" (TS `?:`). */
    optional: boolean;
};

/**
 * Fully resolved description of how to emit a callable.
 *
 * Computed once via {@link buildCallableShape} and consumed by
 * `buildSignatureParameters`, `buildShapeCallArguments`,
 * `computeReturnTypeString`, and `writeCallableBody` in `MethodBodyWriter`.
 */
export type CallableShape = {
    /** Public signature parameters in declaration order. */
    signatureParams: SignatureParam[];
    /** Internally allocated parameters in call order. */
    hiddenOuts: HiddenOut[];
    /** All FFI call arguments in wire order (excluding `self`). */
    callArgs: ShapeCallArg[];
    /** Ordered tuple of values to return. Empty means "no transformation". */
    returnTupleEntries: ReturnTupleEntry[];
    /** Mapped TS type of the original C return value (`"void"` for void). */
    originalReturnTsType: string;
    /** True if the C return value is non-void. */
    hasOriginalReturn: boolean;
    /** True if the original return value is nullable. */
    originalReturnNullable: boolean;
    /** Mapped return type (used for object wrap decisions in body emission). */
    returnTypeMapping: MappedType;
    /** Per-param mapped types in original GIR order (filtered list). */
    paramMappings: ParamMapping[];
    /** Cumulative type imports collected during shape construction. */
    imports: TypeImport[];
};

/**
 * Inputs to {@link buildCallableShape}.
 */
export type CallableShapeInput = {
    /** Original GIR parameters (varargs/closure targets are filtered internally). */
    parameters: readonly GirParameter[];
    /** Mapped return type (already computed by caller). */
    returnTypeMapping: MappedType;
    /** True if the GIR return is nullable. */
    returnNullable: boolean;
    /** 1 for instance methods (where `self` shifts size-param indices), 0 for free functions. */
    sizeParamOffset: number;
    /** FfiMapper instance. */
    ffiMapper: FfiMapper;
};

const PRIMITIVE_INITIAL_VALUES: Record<string, string> = {
    number: "0",
    boolean: "false",
    string: '""',
};

const PRIMITIVE_INITIAL_LITERALS = new Set(["number", "boolean", "string", "unknown"]);

/**
 * Builds the full emission plan for a callable.
 *
 * Determines which parameters appear in the TypeScript signature, which are
 * allocated internally, which length params are hidden entirely, and the
 * ordered return-tuple entries.
 */
type ShapeAccumulator = {
    imports: TypeImport[];
    paramMappings: ParamMapping[];
    signatureParams: SignatureParam[];
    hiddenOuts: HiddenOut[];
    callArgs: ShapeCallArg[];
    tupleOuts: { mapping: ParamMapping; hiddenOutIndex: number | null }[];
};

type ParamContext = {
    param: GirParameter;
    girIndex: number;
    mapped: MappedType;
    jsName: string;
    isNullable: boolean;
    isOptional: boolean;
    isOut: boolean;
    isInout: boolean;
    isLengthParam: boolean;
    isOpaqueCallerAllocates: boolean;
    isCallerAllocatesStruct: boolean;
    tsType: string;
};

const recordMapping = (
    acc: ShapeAccumulator,
    ctx: ParamContext,
    sigPushed: boolean,
    hiddenIndex: number | null,
): void => {
    const mapping: ParamMapping = {
        girIndex: ctx.girIndex,
        jsName: ctx.jsName,
        mapped: ctx.mapped,
        isSignatureParam: sigPushed,
        hiddenOutIndex: hiddenIndex,
        isLengthParam: ctx.isLengthParam,
        isOut: ctx.isOut,
        isInout: ctx.isInout,
        isCallerAllocatesStruct: ctx.isCallerAllocatesStruct,
        nullable: ctx.isNullable,
        optional: ctx.isOptional,
    };
    acc.paramMappings.push(mapping);
    if (ctx.isOut && !ctx.isLengthParam) {
        acc.tupleOuts.push({ mapping, hiddenOutIndex: hiddenIndex });
    }
};

const handleInputParam = (
    acc: ShapeAccumulator,
    ctx: ParamContext,
    filteredParams: GirParameter[],
    lengthToDataIndex: Map<number, number>,
    ffiMapper: FfiMapper,
    sizeParamOffset: number,
): void => {
    if (ctx.isLengthParam) {
        const dataIndex = lengthToDataIndex.get(ctx.girIndex);
        const dataParam = dataIndex === undefined ? undefined : filteredParams[dataIndex];
        const dataMapped = dataParam ? ffiMapper.mapParameter(dataParam, sizeParamOffset) : undefined;
        const dataJsName = dataParam ? toValidIdentifier(toCamelCase(dataParam.name)) : undefined;
        acc.callArgs.push({
            ffi: ctx.mapped.ffi,
            value: buildLengthExpression(dataJsName, dataMapped, dataParam),
            optional: false,
            sourceParamIndex: ctx.girIndex,
        });
        recordMapping(acc, ctx, false, null);
        return;
    }
    acc.signatureParams.push({ name: ctx.jsName, tsType: ctx.tsType, optional: ctx.isOptional });
    acc.callArgs.push({
        ffi: ctx.mapped.ffi,
        value: buildInputValueExpression(ctx.jsName, ctx.mapped, ctx.isNullable || ctx.isOptional),
        optional: ctx.isOptional,
        sourceParamIndex: ctx.girIndex,
    });
    recordMapping(acc, ctx, true, null);
};

const handleOpaqueCallerAllocates = (acc: ShapeAccumulator, ctx: ParamContext): void => {
    acc.signatureParams.push({ name: ctx.jsName, tsType: ctx.tsType, optional: ctx.isOptional });
    acc.callArgs.push({
        ffi: ctx.mapped.ffi,
        value: buildInputValueExpression(ctx.jsName, ctx.mapped, ctx.isNullable || ctx.isOptional),
        optional: ctx.isOptional,
        sourceParamIndex: ctx.girIndex,
    });
    acc.paramMappings.push({
        girIndex: ctx.girIndex,
        jsName: ctx.jsName,
        mapped: ctx.mapped,
        isSignatureParam: true,
        hiddenOutIndex: null,
        isLengthParam: ctx.isLengthParam,
        isOut: false,
        isInout: false,
        isCallerAllocatesStruct: false,
        nullable: ctx.isNullable,
        optional: ctx.isOptional,
    });
};

const handleRefHandleOut = (acc: ShapeAccumulator, ctx: ParamContext): void => {
    const hiddenIndex = acc.hiddenOuts.length;
    const varName = `${ctx.jsName}Ref`;
    const wrapInfo = extractBoxedWrapInfo(ctx.mapped);
    acc.hiddenOuts.push({
        varName,
        tsType: ctx.isNullable
            ? `${ctx.mapped.innerTsType ?? ctx.mapped.ts} | null`
            : (ctx.mapped.innerTsType ?? ctx.mapped.ts),
        initialValue: "null",
        ffi: ctx.mapped.ffi,
        kind: "ref-handle",
        isLengthParam: ctx.isLengthParam,
        nullable: ctx.isNullable,
        wrapClassName: wrapInfo.className,
        wrapAsBoxed: wrapInfo.isBoxed,
    });
    acc.callArgs.push({ ffi: ctx.mapped.ffi, value: varName, optional: false, sourceParamIndex: ctx.girIndex });
    recordMapping(acc, ctx, false, hiddenIndex);
};

const handleRefPrimitiveOut = (acc: ShapeAccumulator, ctx: ParamContext): void => {
    const hiddenIndex = acc.hiddenOuts.length;
    const varName = `${ctx.jsName}Ref`;
    const innerTs = ctx.mapped.innerTsType ?? "unknown";
    const initial = ctx.isInout
        ? inoutInitialValueExpression(ctx.jsName, innerTs, ctx.isNullable || ctx.isOptional)
        : initialValueFor(innerTs);
    acc.hiddenOuts.push({
        varName,
        tsType: innerTs,
        initialValue: initial,
        ffi: ctx.mapped.ffi,
        kind: ctx.isInout ? "ref-primitive-inout" : "ref-primitive",
        isLengthParam: ctx.isLengthParam,
        nullable: ctx.isNullable,
    });
    if (ctx.isInout) {
        const innerSignatureType = formatNullableType(innerTs, ctx.isNullable, false);
        acc.signatureParams.push({ name: ctx.jsName, tsType: innerSignatureType, optional: ctx.isOptional });
    }
    acc.callArgs.push({ ffi: ctx.mapped.ffi, value: varName, optional: false, sourceParamIndex: ctx.girIndex });
    recordMapping(acc, ctx, ctx.isInout, hiddenIndex);
};

const handleAllocStructOut = (acc: ShapeAccumulator, ctx: ParamContext): void => {
    const hiddenIndex = acc.hiddenOuts.length;
    const varName = `${ctx.jsName}Ref`;
    const wrapInfo = extractBoxedWrapInfo(ctx.mapped);
    acc.hiddenOuts.push({
        varName,
        tsType: ctx.mapped.ts,
        initialValue: "",
        ffi: ctx.mapped.ffi,
        kind: "alloc-struct",
        isLengthParam: ctx.isLengthParam,
        nullable: false,
        wrapClassName: wrapInfo.className,
        wrapAsBoxed: wrapInfo.isBoxed,
    });
    acc.callArgs.push({
        ffi: ctx.mapped.ffi,
        value: `${varName}.handle`,
        optional: false,
        sourceParamIndex: ctx.girIndex,
    });
    recordMapping(acc, ctx, false, hiddenIndex);
};

const dispatchOutParam = (acc: ShapeAccumulator, ctx: ParamContext): void => {
    if (ctx.isInout && ctx.mapped.ffi.type !== "ref") {
        acc.signatureParams.push({ name: ctx.jsName, tsType: ctx.tsType, optional: ctx.isOptional });
        acc.callArgs.push({
            ffi: ctx.mapped.ffi,
            value: buildInputValueExpression(ctx.jsName, ctx.mapped, ctx.isNullable || ctx.isOptional),
            optional: ctx.isOptional,
            sourceParamIndex: ctx.girIndex,
        });
        recordMapping(acc, ctx, true, null);
        return;
    }
    if (ctx.isOpaqueCallerAllocates) {
        handleOpaqueCallerAllocates(acc, ctx);
        return;
    }
    if (ctx.mapped.ffi.type === "ref" && refTargetsHandle(ctx.mapped.ffi)) {
        handleRefHandleOut(acc, ctx);
        return;
    }
    if (ctx.mapped.ffi.type === "ref") {
        handleRefPrimitiveOut(acc, ctx);
        return;
    }
    handleAllocStructOut(acc, ctx);
};

export const buildCallableShape = (input: CallableShapeInput): CallableShape => {
    const { parameters, returnTypeMapping, returnNullable, sizeParamOffset, ffiMapper } = input;

    const filteredParams = parameters.filter((p) => !isVararg(p) && !ffiMapper.isClosureTarget(p, parameters));

    const { lengthIndices, lengthToDataIndex } = collectLengthParamIndices(
        filteredParams,
        returnTypeMapping,
        ffiMapper,
        sizeParamOffset,
    );

    const acc: ShapeAccumulator = {
        imports: [],
        paramMappings: [],
        signatureParams: [],
        hiddenOuts: [],
        callArgs: [],
        tupleOuts: [],
    };

    filteredParams.forEach((param, girIndex) => {
        const mapped = ffiMapper.mapParameter(param, sizeParamOffset);
        acc.imports.push(...mapped.imports);

        const isOut = param.direction === "out" || param.direction === "inout";
        const isOpaque =
            isOut &&
            param.callerAllocates &&
            isBoxedOrStructFfi(mapped.ffi) &&
            !ffiMapper.canAllocateLocally(param.type.name);
        const ctx: ParamContext = {
            param,
            girIndex,
            mapped,
            jsName: toValidIdentifier(toCamelCase(param.name)),
            isNullable: param.nullable,
            isOptional: param.optional || param.nullable,
            isOut,
            isInout: param.direction === "inout",
            isLengthParam: lengthIndices.has(girIndex),
            isOpaqueCallerAllocates: isOpaque,
            isCallerAllocatesStruct: isOut && param.callerAllocates && isBoxedOrStructFfi(mapped.ffi) && !isOpaque,
            tsType: formatNullableType(mapped.ts, param.nullable, mapped.ffi.type === "callback"),
        };

        if (!ctx.isOut) {
            handleInputParam(acc, ctx, filteredParams, lengthToDataIndex, ffiMapper, sizeParamOffset);
            return;
        }
        dispatchOutParam(acc, ctx);
    });

    const { imports, paramMappings, signatureParams, hiddenOuts, callArgs, tupleOuts } = acc;

    const reorderedSignature = reorderOptionalLast(signatureParams);

    const hasOriginalReturn = returnTypeMapping.ts !== "void";
    const returnTupleEntries: ReturnTupleEntry[] = [];

    if (hasOriginalReturn && tupleOuts.length > 0) {
        returnTupleEntries.push({
            kind: "original-return",
            tsType: returnTypeMapping.ts,
            nullable: returnNullable,
        });
    }
    for (const { mapping, hiddenOutIndex } of tupleOuts) {
        const passHandleEntry = hiddenOutIndex === null;
        const tupleNullable = mapping.nullable || (passHandleEntry && mapping.optional);
        returnTupleEntries.push({
            kind: mapping.isInout ? "inout-param" : "out-param",
            tsType: outParamReturnTsType(mapping),
            nullable: tupleNullable,
        });
    }

    return {
        signatureParams: reorderedSignature,
        hiddenOuts,
        callArgs,
        returnTupleEntries,
        originalReturnTsType: returnTypeMapping.ts,
        hasOriginalReturn,
        originalReturnNullable: returnNullable,
        returnTypeMapping,
        paramMappings,
        imports,
    };
};

const collectLengthParamIndices = (
    filteredParams: readonly GirParameter[],
    returnTypeMapping: MappedType,
    ffiMapper: FfiMapper,
    sizeParamOffset: number,
): { lengthIndices: Set<number>; lengthToDataIndex: Map<number, number> } => {
    const lengthIndices = new Set<number>();
    const lengthToDataIndex = new Map<number, number>();

    const recordSizeParam = (
        sizeParamIndex: number | undefined,
        dataLocalIndex: number | null,
        dataIsInput: boolean,
    ): void => {
        if (sizeParamIndex === undefined) return;
        const localIndex = sizeParamIndex - sizeParamOffset;
        if (localIndex < 0 || localIndex >= filteredParams.length) return;
        const target = filteredParams[localIndex];
        if (!target) return;
        const targetIsOut = target.direction === "out" || target.direction === "inout";
        if (!targetIsOut && !dataIsInput) {
            return;
        }
        lengthIndices.add(localIndex);
        if (dataLocalIndex !== null) {
            lengthToDataIndex.set(localIndex, dataLocalIndex);
        }
    };

    if (returnTypeMapping.ffi.type === "array") {
        recordSizeParam(returnTypeMapping.ffi.sizeParamIndex, null, false);
    }

    filteredParams.forEach((param, dataLocalIndex) => {
        const mapped = ffiMapper.mapParameter(param, sizeParamOffset);
        const ffi = unwrapRefIfPresent(mapped.ffi);
        if (ffi.type === "array") {
            const dataIsInput = param.direction !== "out" && param.direction !== "inout";
            recordSizeParam(ffi.sizeParamIndex, dataLocalIndex, dataIsInput);
        }
    });

    return { lengthIndices, lengthToDataIndex };
};

const unwrapRefIfPresent = (ffi: FfiTypeDescriptor): FfiTypeDescriptor => {
    if (ffi.type === "ref" && typeof ffi.innerType === "object") {
        return ffi.innerType;
    }
    return ffi;
};

const refTargetsHandle = (ffi: FfiTypeDescriptor): boolean => {
    if (typeof ffi.innerType !== "object") return false;
    const t = ffi.innerType.type;
    return t === "boxed" || t === "gobject" || t === "fundamental" || t === "struct";
};

const isBoxedOrStructFfi = (ffi: FfiTypeDescriptor): boolean => {
    return ffi.type === "boxed" || ffi.type === "gobject" || ffi.type === "struct" || ffi.type === "fundamental";
};

const extractBoxedWrapInfo = (mapped: MappedType): { className: string | undefined; isBoxed: boolean } => {
    const ffi = unwrapRefIfPresent(mapped.ffi);
    if (ffi.type === "boxed" || ffi.type === "gobject" || ffi.type === "struct" || ffi.type === "fundamental") {
        const className = mapped.innerTsType ?? mapped.ts;
        const isBoxed = ffi.type === "boxed" || ffi.type === "fundamental" || ffi.type === "struct";
        return { className, isBoxed };
    }
    return { className: undefined, isBoxed: false };
};

/**
 * Produces the initial-value expression for a hidden `createRef<T>(...)`
 * allocation, including any cast required to satisfy `T`.
 */
const initialValueFor = (tsType: string): string => {
    if (tsType.endsWith("[]")) {
        return "[]";
    }
    if (tsType.includes("|")) {
        return "null";
    }
    if (PRIMITIVE_INITIAL_LITERALS.has(tsType)) {
        return PRIMITIVE_INITIAL_VALUES[tsType] ?? "0";
    }
    if (tsType.includes("<")) {
        return `null as unknown as ${tsType}`;
    }
    return `0 as ${tsType}`;
};

/**
 * Produces the initial value for an inout primitive ref. When the caller's
 * argument may be omitted (`nullable`/`optional`), falls back to the literal
 * default for `innerTs` to keep `createRef<T>(...)` type-safe.
 */
const inoutInitialValueExpression = (jsName: string, innerTs: string, fallbackToDefault: boolean): string => {
    if (!fallbackToDefault) {
        return jsName;
    }
    return `${jsName} ?? ${initialValueFor(innerTs)}`;
};

const outParamReturnTsType = (mapping: ParamMapping): string => {
    return mapping.mapped.innerTsType ?? mapping.mapped.ts;
};

const formatNullableType = (tsType: string, nullable: boolean, isCallback: boolean): string => {
    if (!nullable) return tsType;
    return isCallback ? `(${tsType}) | null` : `${tsType} | null`;
};

const reorderOptionalLast = (params: SignatureParam[]): SignatureParam[] => {
    const required = params.filter((p) => !p.optional);
    const optional = params.filter((p) => p.optional);
    return [...required, ...optional];
};

/**
 * Synthesizes the runtime expression for a length parameter that has been
 * stripped from the public signature. Falls back to `0` when the paired
 * data param is missing or its type is unknown.
 */
const buildLengthExpression = (
    dataJsName: string | undefined,
    dataMapped: MappedType | undefined,
    dataParam: GirParameter | undefined,
): string => {
    if (!dataJsName || !dataMapped) return "0";
    const dataNullable = dataParam?.nullable || dataParam?.optional || false;
    const optChain = dataNullable ? "?." : ".";
    if (dataMapped.ffi.type === "array") {
        return dataNullable ? `(${dataJsName}?.length ?? 0)` : `${dataJsName}.length`;
    }
    if (dataMapped.ffi.type === "string") {
        return dataNullable
            ? `(${dataJsName} === undefined || ${dataJsName} === null ? 0 : Buffer.byteLength(${dataJsName}, "utf8"))`
            : `Buffer.byteLength(${dataJsName}, "utf8")`;
    }
    return `${dataJsName}${optChain}length ?? 0`;
};

/**
 * Generates the JS value expression for an input parameter.
 *
 * Mirrors {@link CallExpressionBuilder.buildValueExpression}: gobject/boxed
 * values pass `.handle`; arrays of objects map to handles; hashtables
 * convert maps to entry arrays. Primitives pass through verbatim.
 */
const buildHandleExpression = (valueName: string, mapped: MappedType, nullable: boolean): string => {
    const isUnknownType = mapped.ts === "unknown";
    if (isUnknownType) {
        return nullable
            ? `(${valueName} as { handle: NativeHandle } | null)?.handle`
            : `(${valueName} as { handle: NativeHandle }).handle`;
    }
    return nullable ? `${valueName}?.handle` : `${valueName}.handle`;
};

const buildHashTableInputExpression = (valueName: string, mapped: MappedType): string => {
    if (isHandleBackedType(mapped.ffi.valueType?.type)) {
        return `${valueName} ? Array.from(${valueName}).map(([k, v]) => [k, v?.handle]) : null`;
    }
    return `${valueName} ? Array.from(${valueName}) : null`;
};

const buildInputValueExpression = (valueName: string, mapped: MappedType, nullable: boolean): string => {
    const needsPtr =
        mapped.ffi.type === "gobject" ||
        mapped.ffi.type === "boxed" ||
        mapped.ffi.type === "struct" ||
        mapped.ffi.type === "fundamental";

    if (needsPtr) {
        return buildHandleExpression(valueName, mapped, nullable);
    }

    if (mapped.ffi.type === "array" && mapped.ffi.itemType && isHandleBackedType(mapped.ffi.itemType.type)) {
        return nullable ? `${valueName}?.map(item => item.handle)` : `${valueName}.map(item => item.handle)`;
    }

    if (mapped.ffi.type === "hashtable") {
        return buildHashTableInputExpression(valueName, mapped);
    }

    return valueName;
};

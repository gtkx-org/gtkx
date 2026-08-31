import type { ParseContext, TypeId } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import {
    attr,
    getChild,
    getChildren,
    getDoc,
    intAttr,
    isAttrTrue,
    nameAttr,
    parseEnumAttr,
    type RawNode,
} from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

/** Which way a parameter's value travels: into the call, back out of it, or both. */
type ParameterDirection = "in" | "out" | "inout";
/** How much of a value the receiver takes ownership of: none, the whole value, or only its container. */
type ParameterTransfer = "none" | "full" | "container";
/**
 * How long a callback parameter stays valid: for the duration of the call, until its destroy notify runs,
 * until the asynchronous operation invokes it, or forever.
 */
type CallbackScope = "call" | "notified" | "async" | "forever";

/**
 * Bounds of an out parameter that points into the buffer of a sibling parameter instead of to an
 * array of its own, which GIR describes as an array with no extent of any kind.
 */
type GirCursorBounds = {
    /** Position of the parameter holding the buffer the pointer points into. */
    baseIndex: number;
    /** Position of the parameter carrying that buffer's element count. */
    lengthIndex: number;
};

/** A parameter of a {@link GirCallable}, with the annotations that decide how it is marshalled. */
type GirParameter = {
    /** The name GIR gives the parameter. */
    name: string;
    /** What the parameter holds, absent when the GIR node declares no type. */
    type: TypeId | undefined;
    /** The C spelling of the parameter's type, taken from its `type` or `array` child. */
    cType: string | undefined;
    /** Documentation prose from GIR, emitted as the parameter's `@param` text. */
    doc: string | undefined;
    /** Decides whether the parameter is an argument, part of the returned tuple, or both. */
    direction: ParameterDirection;
    /** Ownership the marshalling descriptor is generated with, deciding whether the receiver frees the value. */
    transferOwnership: ParameterTransfer;
    /** Whether the value may be null. */
    nullable: boolean;
    /** Whether the caller may leave the parameter out entirely. */
    optional: boolean;
    /** Whether the caller supplies the storage an out parameter writes into. */
    callerAllocates: boolean;
    /** How long a callback parameter stays valid, absent when GIR carries no scope annotation. */
    scope: CallbackScope | undefined;
    /** Position of the parameter carrying the callback's user data. */
    closureIndex: number | undefined;
    /** Position of the parameter carrying the callback's destroy notify. */
    destroyIndex: number | undefined;
    /** Whether the parameter is the `...` varargs marker. */
    isVarargs: boolean;
    /** Where the buffer is that the parameter points into, when it carries a cursor rather than an array. */
    cursor: GirCursorBounds | undefined;
};

/** What a {@link GirCallable} hands back, with the annotations that decide how it is marshalled. */
type GirReturnValue = {
    /** What the callable returns, absent when the GIR node declares no type. */
    type: TypeId | undefined;
    /** The C spelling of the returned type, taken from its `type` or `array` child. */
    cType: string | undefined;
    /** Documentation prose from GIR, emitted as the callable's `@returns` text. */
    doc: string | undefined;
    /** How much ownership the caller takes of the returned value. */
    transferOwnership: ParameterTransfer;
    /** Whether the returned value may be null. */
    nullable: boolean;
    /** Whether GIR marks the value as skipped, keeping it out of the generated signature. */
    skip: boolean;
};

/** Anything GIR describes with parameters and a return value: functions, methods, signals, and callbacks. */
type GirCallable = {
    /** The name GIR gives the callable. */
    name: string;
    /** The callable's documentation text, absent when GIR carries none. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the callable. */
    annotations: GirAnnotations;
    /** The parameters the callable takes, in declaration order. */
    parameters: GirParameter[];
    /** What the callable hands back. */
    returnValue: GirReturnValue;
    /** Whether the callable reports failure through a trailing `GError`. */
    throws: boolean;
    /** Whether GIR exposes the callable to bindings. */
    introspectable: boolean;
};

const DIRECTIONS: Set<ParameterDirection> = new Set(["in", "out", "inout"]);
const TRANSFERS: Set<ParameterTransfer> = new Set(["none", "full", "container"]);
const SCOPES: Set<CallbackScope> = new Set(["call", "notified", "async", "forever"]);

const transferOwnership = (node: RawNode): ParameterTransfer =>
    parseEnumAttr(attr(node, "transfer-ownership"), TRANSFERS, "none", "transfer-ownership");

const isInDirection = (node: RawNode): boolean =>
    parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction") === "in";

const hasNullableAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "nullable") || (isInDirection(node) && isAttrTrue(node, "allow-none"));

const hasOptionalAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "optional") || (!isInDirection(node) && isAttrTrue(node, "allow-none"));

const parameterCType = (node: RawNode): string | undefined =>
    attr(getChild(node, "type"), "c:type") ?? attr(getChild(node, "array"), "c:type");

const parameterFromNode = (node: RawNode, context: ParseContext): GirParameter => ({
    name: nameAttr(node),
    type: typeRefFromNode(node, context),
    cType: parameterCType(node),
    doc: getDoc(node),
    direction: parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction"),
    transferOwnership: transferOwnership(node),
    nullable: hasNullableAttr(node),
    optional: hasOptionalAttr(node),
    callerAllocates: isAttrTrue(node, "caller-allocates"),
    scope: parseEnumAttr(attr(node, "scope"), SCOPES, undefined, "scope"),
    closureIndex: intAttr(node, "closure"),
    destroyIndex: intAttr(node, "destroy"),
    isVarargs: getChild(node, "varargs") !== undefined,
    cursor: undefined,
});

const isOutParameter = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && !parameter.callerAllocates;

const isCallerAllocatedOut = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && parameter.callerAllocates;

const isInoutParameter = (parameter: GirParameter): boolean => parameter.direction === "inout";

const returnValueFromNode = (node: RawNode | undefined, context: ParseContext): GirReturnValue => {
    if (node === undefined) {
        return {
            type: undefined,
            cType: undefined,
            doc: undefined,
            transferOwnership: "none",
            nullable: false,
            skip: false,
        };
    }

    return {
        type: typeRefFromNode(node, context),
        cType: parameterCType(node),
        doc: getDoc(node),
        transferOwnership: transferOwnership(node),
        nullable: hasNullableAttr(node),
        skip: isAttrTrue(node, "skip"),
    };
};

const parseCallable = (node: RawNode, context: ParseContext): GirCallable => {
    const parametersNode = getChild(node, "parameters");
    const parameterNodes = getChildren(parametersNode, "parameter");

    return {
        ...documentedFromNode(node),
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, context)),
        returnValue: returnValueFromNode(getChild(node, "return-value"), context),
        throws: isAttrTrue(node, "throws"),
        introspectable: isAttrTrue(node, "introspectable", true),
    };
};

export {
    transferOwnership,
    parameterFromNode,
    isOutParameter,
    isCallerAllocatedOut,
    isInoutParameter,
    parseCallable,
    type ParameterTransfer,
    type GirCursorBounds,
    type GirParameter,
    type GirReturnValue,
    type GirCallable,
};

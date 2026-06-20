import { attr, attrBool, childOf, childrenOf, intAttr, nameAttr, parseEnumAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromSlot } from "./type-ref.js";

/** Direction of a `<parameter>` (`in`, `out`, `inout`). */
type ParameterDirection = "in" | "out" | "inout";

/**
 * Lifetime conveyed by `transfer-ownership`. Mirrors the GIR vocabulary one
 * for one; the marshal layer translates to the runtime's `Ownership` set.
 */
export type ParameterTransfer = "none" | "full" | "container";

/** Lifetime of a callback parameter (`scope=…`). */
type CallbackScope = "call" | "notified" | "async" | "forever";

const DIRECTIONS: ReadonlySet<ParameterDirection> = new Set(["in", "out", "inout"]);
const TRANSFERS: ReadonlySet<ParameterTransfer> = new Set(["none", "full", "container"]);
const SCOPES: ReadonlySet<CallbackScope> = new Set(["call", "notified", "async", "forever"]);

/**
 * Reads `transfer-ownership` as a {@link ParameterTransfer}, defaulting to
 * `"none"` when absent and rejecting an unmodelled token.
 *
 * @param node - The `<parameter>`, `<return-value>`, or `<property>` element
 */
export const transferOwnership = (node: RawNode): ParameterTransfer =>
    parseEnumAttr(attr(node, "transfer-ownership"), TRANSFERS, "none", "transfer-ownership");

/**
 * Reads the GIR nullability of an element: `nullable="1"` or the legacy
 * `allow-none="1"`.
 *
 * @param node - The `<parameter>` or `<return-value>` element
 */
export const nullableAttr = (node: RawNode): boolean => attrBool(node, "nullable") || attrBool(node, "allow-none");

/**
 * A `<parameter>` or `<instance-parameter>` of a callable.
 *
 * Only the bits the FFI writers actually look at are retained; the original
 * raw node is dropped so the domain model is self-describing.
 */
export type GirParameter = {
    /** Parameter name as authored in GIR (often snake_case). */
    readonly name: string;
    /** Interned type slot of the parameter, or `undefined` when absent. */
    readonly type: TypeId | undefined;
    readonly direction: ParameterDirection;
    readonly transferOwnership: ParameterTransfer;
    readonly nullable: boolean;
    readonly optional: boolean;
    /** `caller-allocates="1"` — used in out parameters that fill a caller buffer. */
    readonly callerAllocates: boolean;
    /** Lifetime of a callback parameter (defined only when the parameter is a callback). */
    readonly scope: CallbackScope | undefined;
    /** Index of the paired `gpointer user_data` parameter in the C signature. */
    readonly closureIndex: number | undefined;
    /** Index of the paired `GDestroyNotify` parameter in the C signature. */
    readonly destroyIndex: number | undefined;
    /** `<varargs/>` parameter; not marshalable. */
    readonly isVarargs: boolean;
};

/**
 * Builds a {@link GirParameter} from a `<parameter>` or `<instance-parameter>`.
 *
 * @param node - The XML element
 * @param context - The per-namespace interning seam
 */
export const parameterFromNode = (node: RawNode, context: ParseContext): GirParameter => ({
    name: nameAttr(node),
    type: typeRefFromSlot(node, context),
    direction: parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction"),
    transferOwnership: transferOwnership(node),
    nullable: nullableAttr(node),
    optional: attrBool(node, "optional"),
    callerAllocates: attrBool(node, "caller-allocates"),
    scope: parseEnumAttr(attr(node, "scope"), SCOPES, undefined, "scope"),
    closureIndex: intAttr(node, "closure"),
    destroyIndex: intAttr(node, "destroy"),
    isVarargs: childOf(node, "varargs") !== undefined,
});

/**
 * Whether a parameter is a pure out-parameter: `direction="out"` and not
 * caller-allocated, so it marshals through a `{ value }` cell the callee writes into.
 *
 * @param parameter - The parameter to test
 */
export const isOutParameter = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && !parameter.callerAllocates;

/**
 * Whether a parameter is a caller-allocated out-parameter: `direction="out"`
 * with `caller-allocates="1"`, passed as a pre-built handle the callee fills
 * in place rather than through a `{ value }` cell.
 *
 * @param parameter - The parameter to test
 */
export const isCallerAllocatedOut = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && parameter.callerAllocates;

/**
 * Whether a parameter is an inout parameter (`direction="inout"`).
 *
 * @param parameter - The parameter to test
 */
export const isInoutParameter = (parameter: GirParameter): boolean => parameter.direction === "inout";

/** A `<return-value>` plus its inferred type and transfer settings. */
export type GirReturnValue = {
    readonly type: TypeId | undefined;
    readonly transferOwnership: ParameterTransfer;
    readonly nullable: boolean;
    /**
     * `skip="1"` — the C return value carries no information a JS caller needs
     * (the `(skip)` annotation), so it is dropped from the surfaced return,
     * leaving only the out-parameters.
     */
    readonly skip: boolean;
};

/**
 * Builds a {@link GirReturnValue} from a `<return-value>` element, or returns a
 * void return when the element is missing.
 *
 * @param node - The `<return-value>` element, or `undefined`
 * @param context - The per-namespace interning seam
 */
export const returnValueFromNode = (node: RawNode | undefined, context: ParseContext): GirReturnValue => {
    if (node === undefined) {
        return { type: undefined, transferOwnership: "none", nullable: false, skip: false };
    }
    return {
        type: typeRefFromSlot(node, context),
        transferOwnership: transferOwnership(node),
        nullable: nullableAttr(node),
        skip: attrBool(node, "skip"),
    };
};

/** The name, parameters, and return value shared by every GIR callable element. */
type GirCallable = {
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
};

/**
 * Parses the `name`, `<parameters>`, and `<return-value>` shared by GIR
 * callable elements such as `<callback>` and `<glib:signal>`.
 *
 * @param node - The callable element (a `<callback>`, `<glib:signal>`, etc.)
 * @param context - The per-namespace interning seam
 * @returns The callable's name, parsed parameters, and parsed return value.
 */
export const parseCallable = (node: RawNode, context: ParseContext): GirCallable => {
    const parametersNode = childOf(node, "parameters");
    const parameterNodes = childrenOf(parametersNode, "parameter");
    return {
        name: nameAttr(node),
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, context)),
        returnValue: returnValueFromNode(childOf(node, "return-value"), context),
    };
};

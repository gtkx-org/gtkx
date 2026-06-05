import { attr, attrBool, childOf, type RawNode } from "./parse.js";
import { type GirTypeRef, typeRefFromSlot } from "./type-ref.js";

/** Direction of a `<parameter>` (`in`, `out`, `inout`). */
type ParameterDirection = "in" | "out" | "inout";

/**
 * Lifetime conveyed by `transfer-ownership`. Mirrors the GIR vocabulary one
 * for one; the marshal layer translates to the runtime's `Ownership` set.
 */
export type ParameterTransfer = "none" | "full" | "container";

/** Lifetime of a callback parameter (`scope=…`). */
type CallbackScope = "call" | "notified" | "async" | "forever";

/**
 * A `<parameter>` or `<instance-parameter>` of a callable.
 *
 * Only the bits the FFI writers actually look at are retained; the original
 * raw node is dropped so the domain model is self-describing.
 */
export type GirParameter = {
    /** Parameter name as authored in GIR (often snake_case). */
    readonly name: string;
    /** Typed slot of the parameter, or `undefined` for `<varargs/>`. */
    readonly type: GirTypeRef | undefined;
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
 */
export const parameterFromNode = (node: RawNode): GirParameter => {
    const direction = (attr(node, "direction") ?? "in") as ParameterDirection;
    const transferOwnership = (attr(node, "transfer-ownership") ?? "none") as ParameterTransfer;
    const closure = attr(node, "closure");
    const destroy = attr(node, "destroy");
    return {
        name: attr(node, "name") ?? "",
        type: typeRefFromSlot(node),
        direction,
        transferOwnership,
        nullable: attrBool(node, "nullable") || attrBool(node, "allow-none"),
        optional: attrBool(node, "optional"),
        callerAllocates: attrBool(node, "caller-allocates"),
        scope: attr(node, "scope") as CallbackScope | undefined,
        closureIndex: closure === undefined ? undefined : Number.parseInt(closure, 10),
        destroyIndex: destroy === undefined ? undefined : Number.parseInt(destroy, 10),
        isVarargs: childOf(node, "varargs") !== undefined,
    };
};

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
    readonly type: GirTypeRef | undefined;
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
 */
export const returnValueFromNode = (node: RawNode | undefined): GirReturnValue => {
    if (node === undefined) {
        return { type: undefined, transferOwnership: "none", nullable: false, skip: false };
    }
    return {
        type: typeRefFromSlot(node),
        transferOwnership: (attr(node, "transfer-ownership") ?? "none") as ParameterTransfer,
        nullable: attrBool(node, "nullable") || attrBool(node, "allow-none"),
        skip: attrBool(node, "skip"),
    };
};

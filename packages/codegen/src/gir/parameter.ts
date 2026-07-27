import type { ParseContext, TypeId } from "./type-id.js";
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

type ParameterDirection = "in" | "out" | "inout";
type ParameterTransfer = "none" | "full" | "container";
type CallbackScope = "call" | "notified" | "async" | "forever";

type GirParameter = {
    name: string;
    type: TypeId | undefined;
    direction: ParameterDirection;
    transferOwnership: ParameterTransfer;
    nullable: boolean;
    optional: boolean;
    callerAllocates: boolean;
    scope: CallbackScope | undefined;
    closureIndex: number | undefined;
    destroyIndex: number | undefined;
    isVarargs: boolean;
};

type GirReturnValue = {
    type: TypeId | undefined;
    transferOwnership: ParameterTransfer;
    nullable: boolean;
    skip: boolean;
};

type GirCallable = {
    name: string;
    doc: string | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
    throws: boolean;
    introspectable: boolean;
};

const DIRECTIONS: Set<ParameterDirection> = new Set(["in", "out", "inout"]);
const TRANSFERS: Set<ParameterTransfer> = new Set(["none", "full", "container"]);
const SCOPES: Set<CallbackScope> = new Set(["call", "notified", "async", "forever"]);

const transferOwnership = (node: RawNode): ParameterTransfer =>
    parseEnumAttr(attr(node, "transfer-ownership"), TRANSFERS, "none", "transfer-ownership");

// `allow-none` is the legacy spelling of two different attributes: on an in-parameter it means the
// value may be NULL (`nullable`), but on an out-parameter it means the caller may pass a NULL
// location (`optional`). Folding it into `nullable` for an out-parameter would claim the returned
// value can be null for the 494 out-parameters across the installed GIRs that only say `allow-none`.
const isInDirection = (node: RawNode): boolean =>
    parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction") === "in";

const hasNullableAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "nullable") || (isInDirection(node) && isAttrTrue(node, "allow-none"));

const hasOptionalAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "optional") || (!isInDirection(node) && isAttrTrue(node, "allow-none"));

const parameterFromNode = (node: RawNode, context: ParseContext): GirParameter => ({
    name: nameAttr(node),
    type: typeRefFromNode(node, context),
    direction: parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction"),
    transferOwnership: transferOwnership(node),
    nullable: hasNullableAttr(node),
    optional: hasOptionalAttr(node),
    callerAllocates: isAttrTrue(node, "caller-allocates"),
    scope: parseEnumAttr(attr(node, "scope"), SCOPES, undefined, "scope"),
    closureIndex: intAttr(node, "closure"),
    destroyIndex: intAttr(node, "destroy"),
    isVarargs: getChild(node, "varargs") !== undefined,
});

const isOutParameter = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && !parameter.callerAllocates;

const isCallerAllocatedOut = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && parameter.callerAllocates;

const isInoutParameter = (parameter: GirParameter): boolean => parameter.direction === "inout";

const returnValueFromNode = (node: RawNode | undefined, context: ParseContext): GirReturnValue => {
    if (node === undefined) {
        return { type: undefined, transferOwnership: "none", nullable: false, skip: false };
    }

    return {
        type: typeRefFromNode(node, context),
        transferOwnership: transferOwnership(node),
        nullable: hasNullableAttr(node),
        skip: isAttrTrue(node, "skip"),
    };
};

const parseCallable = (node: RawNode, context: ParseContext): GirCallable => {
    const parametersNode = getChild(node, "parameters");
    const parameterNodes = getChildren(parametersNode, "parameter");

    return {
        name: nameAttr(node),
        doc: getDoc(node),
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
    type GirParameter,
    type GirReturnValue,
    type GirCallable,
};

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
import { typeCTypeFromNode, typeRefFromNode } from "./type-ref.js";

type ParameterDirection = "in" | "out" | "inout";
type ParameterTransfer = "none" | "full" | "container" | "elements";
type CallbackScope = "call" | "notified" | "async" | "forever";

type GirCursorBounds = {
    baseIndex: number;
    lengthIndex: number;
};

type GirParameter = {
    name: string;
    type: TypeId | undefined;
    cType: string | undefined;
    doc: string | undefined;
    direction: ParameterDirection;
    transferOwnership: ParameterTransfer;
    nullable: boolean;
    optional: boolean;
    callerAllocates: boolean;
    scope: CallbackScope | undefined;
    closureIndex: number | undefined;
    destroyIndex: number | undefined;
    isVarargs: boolean;
    cursor: GirCursorBounds | undefined;
};

type GirReturnValue = {
    type: TypeId | undefined;
    cType: string | undefined;
    doc: string | undefined;
    transferOwnership: ParameterTransfer;
    nullable: boolean;
    skip: boolean;
};

type GirCallable = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
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

const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer => {
    if (transfer === "container") {
        return "none";
    }

    return transfer === "elements" ? "full" : transfer;
};

const isInDirection = (node: RawNode): boolean =>
    parseEnumAttr(attr(node, "direction"), DIRECTIONS, "in", "direction") === "in";

const hasNullableAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "nullable") || (isInDirection(node) && isAttrTrue(node, "allow-none"));

const hasOptionalAttr = (node: RawNode): boolean =>
    isAttrTrue(node, "optional") || (!isInDirection(node) && isAttrTrue(node, "allow-none"));

const parameterCType = (node: RawNode): string | undefined =>
    typeCTypeFromNode(node) ?? attr(getChild(node, "array"), "c:type");

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
    deriveElementTransfer,
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

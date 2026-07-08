import { attr, attrBool, childOf, childrenOf, docOf, intAttr, nameAttr, parseEnumAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromNode } from "./type-ref.js";

type ParameterDirection = "in" | "out" | "inout";

export type ParameterTransfer = "none" | "full" | "container";

type CallbackScope = "call" | "notified" | "async" | "forever";

const DIRECTIONS: Set<ParameterDirection> = new Set(["in", "out", "inout"]);
const TRANSFERS: Set<ParameterTransfer> = new Set(["none", "full", "container"]);
const SCOPES: Set<CallbackScope> = new Set(["call", "notified", "async", "forever"]);

export const transferOwnership = (node: RawNode): ParameterTransfer =>
    parseEnumAttr(attr(node, "transfer-ownership"), TRANSFERS, "none", "transfer-ownership");

const nullableAttr = (node: RawNode): boolean => attrBool(node, "nullable") || attrBool(node, "allow-none");

export type GirParameter = {
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

export const parameterFromNode = (node: RawNode, context: ParseContext): GirParameter => ({
    name: nameAttr(node),
    type: typeRefFromNode(node, context),
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

export const isOutParameter = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && !parameter.callerAllocates;

export const isCallerAllocatedOut = (parameter: GirParameter): boolean =>
    parameter.direction === "out" && parameter.callerAllocates;

export const isInoutParameter = (parameter: GirParameter): boolean => parameter.direction === "inout";

export type GirReturnValue = {
    type: TypeId | undefined;
    transferOwnership: ParameterTransfer;
    nullable: boolean;
    skip: boolean;
};

const returnValueFromNode = (node: RawNode | undefined, context: ParseContext): GirReturnValue => {
    if (node === undefined) {
        return { type: undefined, transferOwnership: "none", nullable: false, skip: false };
    }
    return {
        type: typeRefFromNode(node, context),
        transferOwnership: transferOwnership(node),
        nullable: nullableAttr(node),
        skip: attrBool(node, "skip"),
    };
};

export type GirSignal = {
    name: string;
    doc: string | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
};

export const parseCallable = (node: RawNode, context: ParseContext): GirSignal => {
    const parametersNode = childOf(node, "parameters");
    const parameterNodes = childrenOf(parametersNode, "parameter");
    return {
        name: nameAttr(node),
        doc: docOf(node),
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, context)),
        returnValue: returnValueFromNode(childOf(node, "return-value"), context),
    };
};

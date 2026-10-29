import type { GirAnnotations } from "./annotations.js";
import type { ParseContext } from "./type-id.js";
import { PARAMETER_DIRECTION_OVERRIDES } from "./direction-overrides.js";
import { HIDDEN_SYMBOLS } from "./hidden-symbols.js";
import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, getChild, getChildren, intAttr, type RawNode } from "./parse.js";
import { PARAMETER_TRANSFER_OVERRIDES, RETURN_TRANSFER_OVERRIDES } from "./transfer-overrides.js";

type GirFunction = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    cIdentifier: string | undefined;
    throws: boolean;
    introspectable: boolean;
    movedTo: string | undefined;
    shadowedBy: string | undefined;
    finishFunc: string | undefined;
    instance: GirParameter | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
};

const DECLARED_FUNCTION_NAMES: WeakMap<GirFunction, string> = new WeakMap();

const applyReturnTransfer = (fn: GirFunction): GirFunction => {
    const transfer = fn.cIdentifier === undefined ? undefined : RETURN_TRANSFER_OVERRIDES.get(fn.cIdentifier);

    if (transfer !== undefined) {
        fn.returnValue.transferOwnership = transfer;
    }

    return fn;
};

const applyParameterOverrides = (fn: GirFunction): GirFunction => {
    if (fn.cIdentifier === undefined) {
        return fn;
    }

    for (const parameter of fn.parameters) {
        const key = `${fn.cIdentifier}:${parameter.name}`;
        parameter.transferOwnership = PARAMETER_TRANSFER_OVERRIDES.get(key) ?? parameter.transferOwnership;
        parameter.direction = PARAMETER_DIRECTION_OVERRIDES.get(key) ?? parameter.direction;
    }

    return fn;
};

const isHiddenSymbol = (cIdentifier: string | undefined): boolean =>
    cIdentifier !== undefined && HIDDEN_SYMBOLS.has(cIdentifier);

/** Scanner-inferred output lengths can still be scalar C inputs for caller-allocated arrays. */
const normalizeCallerArrayLengths = (fn: GirFunction, node: RawNode): void => {
    const parameters = getChildren(getChild(node, "parameters"), "parameter");
    for (const [index, raw] of parameters.entries()) {
        if (fn.parameters[index]?.callerAllocates !== true) continue;
        const length = intAttr(getChild(raw, "array") ?? {}, "length");
        const capacity = length === undefined ? undefined : fn.parameters[length];
        if (
            capacity?.direction === "out" &&
            capacity.cType !== undefined &&
            !/\*|g(?:const)?pointer/.test(capacity.cType)
        ) {
            capacity.direction = "in";
        }
    }
};

const functionFromNode = (node: RawNode, context: ParseContext): GirFunction => {
    const instanceNode = getChild(getChild(node, "parameters"), "instance-parameter");
    const callable = parseCallable(node, context);
    const cIdentifier = attr(node, "c:identifier");
    const declaredName = attr(node, "name") ?? "";

    const fn: GirFunction = {
        ...callable,
        introspectable: callable.introspectable && !isHiddenSymbol(cIdentifier),
        name: attr(node, "shadows") ?? declaredName,
        cIdentifier,
        movedTo: attr(node, "moved-to"),
        shadowedBy: attr(node, "shadowed-by"),
        finishFunc: attr(node, "glib:finish-func"),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
    };

    if (declaredName !== fn.name) {
        DECLARED_FUNCTION_NAMES.set(fn, declaredName);
    }

    normalizeCallerArrayLengths(fn, node);

    return applyParameterOverrides(applyReturnTransfer(fn));
};

/** GIR regenerated from a typelib by `g-ir-generate` omits `<instance-parameter>`, but every method takes its owner as receiver. */
const methodFromNode = (node: RawNode, owner: string, context: ParseContext): GirFunction => {
    const fn = functionFromNode(node, context);
    fn.instance ??= parameterFromNode({ "@_name": "self", type: { "@_name": owner } }, context);
    return fn;
};

const declaredFunctionName = (fn: GirFunction): string => DECLARED_FUNCTION_NAMES.get(fn) ?? fn.name;

export { declaredFunctionName, functionFromNode, methodFromNode, type GirFunction };

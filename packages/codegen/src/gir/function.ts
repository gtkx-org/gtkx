import type { GirAnnotations } from "./annotations.js";
import type { ParseContext } from "./type-id.js";
import { type CursorParameterNames, PARAMETERS_MISSING_ARRAY_EXTENT } from "./cursor-overrides.js";
import { FUNCTIONS_MISSING_FINISH_FUNC } from "./finish-overrides.js";
import { HIDDEN_SYMBOLS } from "./hidden-symbols.js";
import { PARAMETERS_MISSING_NULLABLE_ANNOTATION } from "./nullable-overrides.js";
import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, getChild, type RawNode } from "./parse.js";
import { RETURN_TRANSFER_OVERRIDES } from "./transfer-overrides.js";
import { RETURNS_MISSING_UCS4_ARRAY_TYPE } from "./ucs4-overrides.js";

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

const relaxParameters = (parameters: GirParameter[], names: string[]): void => {
    for (const parameter of parameters) {
        if (names.includes(parameter.name)) {
            parameter.nullable = true;
        }
    }
};

const relaxMissingNullable = (fn: GirFunction): GirFunction => {
    const names = fn.cIdentifier === undefined ? undefined : PARAMETERS_MISSING_NULLABLE_ANNOTATION.get(fn.cIdentifier);

    if (names !== undefined) {
        relaxParameters(fn.parameters, names);
    }

    return fn;
};

const parameterIndexFor = (parameters: GirParameter[], name: string): number => {
    const index = parameters.findIndex((parameter) => parameter.name === name);

    if (index === -1) {
        throw new Error(`A cursor correction names a parameter the GIR does not declare: ${name}`);
    }

    return index;
};

const bindCursorParameters = (parameters: GirParameter[], corrections: CursorParameterNames[]): void => {
    for (const names of corrections) {
        const parameter = parameters[parameterIndexFor(parameters, names.cursor)];

        if (parameter !== undefined) {
            parameter.cursor = {
                baseIndex: parameterIndexFor(parameters, names.base),
                lengthIndex: parameterIndexFor(parameters, names.length),
            };
        }
    }
};

const bindMissingArrayExtent = (fn: GirFunction): GirFunction => {
    const corrections = fn.cIdentifier === undefined ? undefined : PARAMETERS_MISSING_ARRAY_EXTENT.get(fn.cIdentifier);

    if (corrections !== undefined) {
        bindCursorParameters(fn.parameters, corrections);
    }

    return fn;
};

const bindMissingUcs4ReturnArray = (fn: GirFunction, context: ParseContext): GirFunction => {
    if (fn.cIdentifier !== undefined && RETURNS_MISSING_UCS4_ARRAY_TYPE.has(fn.cIdentifier)) {
        fn.returnValue.type = context.addContainer({
            kind: "carray",
            element: context.addPrimitive("unichar"),
            elementCType: "gunichar",
            arrayCType: "gunichar*",
            lengthParameterIndex: undefined,
            fixedSize: undefined,
            isZeroTerminated: true,
        });
    }

    return fn;
};

const applyReturnTransfer = (fn: GirFunction): GirFunction => {
    const transfer = fn.cIdentifier === undefined ? undefined : RETURN_TRANSFER_OVERRIDES.get(fn.cIdentifier);

    if (transfer !== undefined) {
        fn.returnValue.transferOwnership = transfer;
    }

    return fn;
};

const annotatedFinishFunc = (node: RawNode, cIdentifier: string | undefined): string | undefined => {
    const annotated = attr(node, "glib:finish-func");

    if (annotated !== undefined) {
        return annotated;
    }

    return cIdentifier === undefined ? undefined : FUNCTIONS_MISSING_FINISH_FUNC.get(cIdentifier);
};

const isHiddenSymbol = (cIdentifier: string | undefined): boolean =>
    cIdentifier !== undefined && HIDDEN_SYMBOLS.has(cIdentifier);

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
        finishFunc: annotatedFinishFunc(node, cIdentifier),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
    };

    if (declaredName !== fn.name) {
        DECLARED_FUNCTION_NAMES.set(fn, declaredName);
    }

    const relaxed = applyReturnTransfer(relaxMissingNullable(fn));

    return bindMissingUcs4ReturnArray(bindMissingArrayExtent(relaxed), context);
};

const declaredFunctionName = (fn: GirFunction): string => DECLARED_FUNCTION_NAMES.get(fn) ?? fn.name;

export { declaredFunctionName, functionFromNode, type GirFunction };

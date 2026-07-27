import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { TypeId } from "../gir/type-id.js";
import { type GirCallable, type GirParameter, isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import { isCellInout, shouldOmitPrimaryReturn } from "./descriptor-render.js";

type InputParameter = {
    parameter: GirParameter;
    index: number;
};

type HandlerResultOptions = {
    library: Library;
    signal: GirCallable;
    renderType: (ref: TypeId | undefined, isNullable: boolean) => string;
    includeCallerAllocated: boolean;
    optOut: boolean;
};

const isInputParameter = (options: {
    parameter: GirParameter;
    index: number;
    lengthIndices: Set<number>;
    closureIndices: Set<number>;
}): boolean => {
    const { parameter, index, lengthIndices, closureIndices } = options;

    if (parameter.isVarargs) {
        return false;
    }

    if (isOutParameter(parameter)) {
        return false;
    }

    if (isCallerAllocatedOut(parameter)) {
        return false;
    }

    if (lengthIndices.has(index)) {
        return false;
    }

    return !closureIndices.has(index);
};

const inputParameters = (library: Library, fn: GirFunction): InputParameter[] => {
    const lengthIndices = arrayLengthIndices(library, fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const result: InputParameter[] = [];

    for (const [index, parameter] of fn.parameters.entries()) {
        if (isInputParameter({ parameter, index, lengthIndices, closureIndices })) {
            result.push({ parameter, index });
        }
    }

    return result;
};

const closureAndDestroyIndices = (fn: GirFunction): Set<number> => {
    const indices: Set<number> = new Set();

    for (const parameter of fn.parameters) {
        if (parameter.closureIndex !== undefined) {
            indices.add(parameter.closureIndex);
        }

        if (parameter.destroyIndex !== undefined) {
            indices.add(parameter.destroyIndex);
        }
    }

    return indices;
};

// The emitted argument list is the instance parameter followed by every parameter `planParameter`
// keeps, so a GIR index only lines up with an emitted index when nothing before it was dropped.
const emittedArgIndices = (fn: GirFunction, instanceOffset: number): Map<number, number> => {
    const closureIndices = closureAndDestroyIndices(fn);
    const map: Map<number, number> = new Map();
    let emitted = instanceOffset;

    for (const [index, parameter] of fn.parameters.entries()) {
        if (parameter.isVarargs || closureIndices.has(index)) {
            continue;
        }

        map.set(index, emitted);
        emitted += 1;
    }

    return map;
};

const arrayLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const map = arrayLengthSources(library, fn);

    return new Set(map.keys());
};

const carrayLengthIndex = (library: Library, ref: TypeId | undefined): number | undefined => {
    const type = ref === undefined ? undefined : library.typeFor(ref);

    if (type?.kind !== "carray") {
        return undefined;
    }

    return type.lengthParameterIndex;
};

const arrayLengthSources = (library: Library, fn: GirFunction): Map<number, number> => {
    const map: Map<number, number> = new Map();

    for (const [index, parameter] of fn.parameters.entries()) {
        const lengthIndex = carrayLengthIndex(library, parameter.type);

        if (lengthIndex !== undefined) {
            map.set(lengthIndex, index);
        }
    }

    return map;
};

const hasCallerAllocatedArrayLength = (library: Library, fn: GirFunction): boolean => {
    for (const arrayIndex of arrayLengthSources(library, fn).values()) {
        const array = fn.parameters[arrayIndex];

        if (array !== undefined && isCallerAllocatedOut(array)) {
            return true;
        }
    }

    return false;
};

const returnArrayLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const returnType = fn.returnValue.type === undefined ? undefined : library.typeFor(fn.returnValue.type);

    if (returnType?.kind !== "carray") {
        return new Set();
    }

    const lengthIndex = returnType.lengthParameterIndex;

    if (lengthIndex === undefined) {
        return new Set();
    }

    return new Set([lengthIndex]);
};

const foldedLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const indices: Set<number> = new Set(arrayLengthSources(library, fn).keys());

    for (const index of returnArrayLengthIndices(library, fn)) {
        indices.add(index);
    }

    return indices;
};

const parameterIdentifier = (parameter: GirParameter, index: number): string => {
    if (parameter.name.length === 0) {
        return `arg${String(index)}`;
    }

    return toCamelIdentifier(parameter.name);
};

const renderHandlerParameters = (
    parameters: GirParameter[],
    renderType: (ref: TypeId | undefined, isNullable: boolean) => string,
    shouldExclude: (parameter: GirParameter) => boolean = () => false,
): string[] =>
    parameters
        .filter((parameter) => !parameter.isVarargs && !isOutParameter(parameter) && !shouldExclude(parameter))
        .map(
            (parameter, index) =>
                `${parameterIdentifier(parameter, index)}: ${renderType(parameter.type, parameter.nullable)}`,
        );

const foldOutParamShape = (primary: string | undefined, outTypes: string[]): string => {
    if (primary !== undefined) {
        return `[${primary}, ${outTypes.join(", ")}]`;
    }

    const [single, ...rest] = outTypes;

    if (single !== undefined && rest.length === 0) {
        return single;
    }

    return `[${outTypes.join(", ")}]`;
};

const isHandlerOutParameter = (options: {
    library: Library;
    parameter: GirParameter;
    includeCallerAllocated: boolean;
}): boolean => {
    const { library, parameter, includeCallerAllocated } = options;

    if (parameter.isVarargs) {
        return false;
    }

    if (isOutParameter(parameter)) {
        return true;
    }

    if (isCellInout(library, parameter)) {
        return true;
    }

    return includeCallerAllocated && isCallerAllocatedOut(parameter);
};

const scalarResultType = (primary: string | undefined, isOptOut: boolean): string => {
    if (primary === undefined) {
        return "void";
    }

    return isOptOut ? `${primary} | undefined` : primary;
};

const renderHandlerResultType = (options: HandlerResultOptions): string => {
    const { library, signal, renderType, includeCallerAllocated, optOut } = options;

    const primary = shouldOmitPrimaryReturn(library, signal.returnValue)
        ? undefined
        : renderType(signal.returnValue.type, signal.returnValue.nullable);

    const outTypes = signal.parameters
        .filter((parameter) => isHandlerOutParameter({ library, parameter, includeCallerAllocated }))
        .map((parameter) => renderType(parameter.type, parameter.nullable));

    if (outTypes.length === 0) {
        return scalarResultType(primary, optOut);
    }

    return foldOutParamShape(primary, outTypes);
};

export {
    emittedArgIndices,
    inputParameters,
    closureAndDestroyIndices,
    arrayLengthSources,
    hasCallerAllocatedArrayLength,
    foldedLengthIndices,
    parameterIdentifier,
    renderHandlerParameters,
    foldOutParamShape,
    renderHandlerResultType,
};

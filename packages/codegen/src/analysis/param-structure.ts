import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import { type GirParameter, type GirSignal, isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { isCellInout, omitsPrimaryReturn } from "./descriptor-render.js";

type InputParameter = {
    parameter: GirParameter;
    index: number;
};

export const inputParameters = (library: Library, fn: GirFunction): InputParameter[] => {
    const lengthIndices = arrayLengthIndices(library, fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const result: InputParameter[] = [];
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (isOutParameter(parameter)) return;
        if (isCallerAllocatedOut(parameter)) return;
        if (lengthIndices.has(index)) return;
        if (closureIndices.has(index)) return;
        result.push({ parameter, index });
    });
    return result;
};

export const closureAndDestroyIndices = (fn: GirFunction): Set<number> => {
    const indices = new Set<number>();
    for (const parameter of fn.parameters) {
        if (parameter.closureIndex !== undefined) indices.add(parameter.closureIndex);
        if (parameter.destroyIndex !== undefined) indices.add(parameter.destroyIndex);
    }
    return indices;
};

const arrayLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const map = arrayLengthSources(library, fn);
    return new Set(map.keys());
};

export const arrayLengthSources = (library: Library, fn: GirFunction): Map<number, number> => {
    const map = new Map<number, number>();
    fn.parameters.forEach((parameter, index) => {
        const type = parameter.type === undefined ? undefined : library.typeOf(parameter.type);
        if (type?.kind !== "carray") return;
        const lengthIndex = type.lengthParameterIndex;
        if (lengthIndex === undefined) return;
        map.set(lengthIndex, index);
    });
    return map;
};

const returnArrayLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const returnType = fn.returnValue.type === undefined ? undefined : library.typeOf(fn.returnValue.type);
    if (returnType?.kind !== "carray") return new Set();
    const lengthIndex = returnType.lengthParameterIndex;
    if (lengthIndex === undefined) return new Set();
    return new Set([lengthIndex]);
};

export const foldedLengthIndices = (library: Library, fn: GirFunction): Set<number> => {
    const indices = new Set<number>(arrayLengthSources(library, fn).keys());
    for (const index of returnArrayLengthIndices(library, fn)) indices.add(index);
    return indices;
};

export const parameterIdentifier = (parameter: GirParameter, index: number): string => {
    if (parameter.name.length === 0) return `arg${index}`;
    return toCamelIdentifier(parameter.name);
};

export const renderHandlerParameters = (
    parameters: GirParameter[],
    renderType: (ref: TypeId | undefined, nullable: boolean) => string,
    additionalExclude: (parameter: GirParameter) => boolean = () => false,
): string[] =>
    parameters
        .filter((parameter) => !parameter.isVarargs && !isOutParameter(parameter) && !additionalExclude(parameter))
        .map(
            (parameter, index) =>
                `${parameterIdentifier(parameter, index)}: ${renderType(parameter.type, parameter.nullable)}`,
        );

export const foldOutParamShape = (primary: string | undefined, outTypes: string[]): string => {
    if (primary !== undefined) return `[${primary}, ${outTypes.join(", ")}]`;
    const [single, ...rest] = outTypes;
    if (rest.length === 0 && single !== undefined) return single;
    return `[${outTypes.join(", ")}]`;
};

type HandlerResultOptions = {
    library: Library;
    signal: GirSignal;
    renderType: (ref: TypeId | undefined, nullable: boolean) => string;
    includeCallerAllocated: boolean;
    optOut: boolean;
};

export const renderHandlerResultType = (options: HandlerResultOptions): string => {
    const { library, signal, renderType, includeCallerAllocated, optOut } = options;
    const primary = omitsPrimaryReturn(library, signal.returnValue)
        ? undefined
        : renderType(signal.returnValue.type, signal.returnValue.nullable);
    const outTypes = signal.parameters
        .filter(
            (parameter) =>
                !parameter.isVarargs &&
                (isOutParameter(parameter) ||
                    isCellInout(library, parameter) ||
                    (includeCallerAllocated && isCallerAllocatedOut(parameter))),
        )
        .map((parameter) => renderType(parameter.type, false));
    if (outTypes.length === 0) {
        if (primary === undefined) return "void";
        return optOut ? `${primary} | undefined` : primary;
    }
    return foldOutParamShape(primary, outTypes);
};

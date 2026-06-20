import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import type { GirRepository } from "../gir/repository.js";
import type { TypeId } from "../gir/type-id.js";

export type InputParameter = {
    parameter: GirParameter;
    index: number;
};

export const inputParameters = (repository: GirRepository, fn: GirFunction): InputParameter[] => {
    const lengthIndices = arrayLengthIndices(repository, fn);
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

const arrayLengthIndices = (repository: GirRepository, fn: GirFunction): Set<number> => {
    const map = arrayLengthSources(repository, fn);
    return new Set(map.keys());
};

export const arrayLengthSources = (repository: GirRepository, fn: GirFunction): Map<number, number> => {
    const map = new Map<number, number>();
    fn.parameters.forEach((parameter, index) => {
        const type = parameter.type === undefined ? undefined : repository.typeOf(parameter.type);
        if (type?.kind !== "carray") return;
        const lengthIndex = type.lengthParameterIndex;
        if (lengthIndex === undefined) return;
        map.set(lengthIndex, index);
    });
    return map;
};

const returnArrayLengthIndices = (repository: GirRepository, fn: GirFunction): Set<number> => {
    const returnType = fn.returnValue.type === undefined ? undefined : repository.typeOf(fn.returnValue.type);
    if (returnType?.kind !== "carray") return new Set();
    const lengthIndex = returnType.lengthParameterIndex;
    if (lengthIndex === undefined) return new Set();
    return new Set([lengthIndex]);
};

export const foldedLengthIndices = (repository: GirRepository, fn: GirFunction): Set<number> => {
    const indices = new Set<number>(arrayLengthSources(repository, fn).keys());
    for (const index of returnArrayLengthIndices(repository, fn)) indices.add(index);
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

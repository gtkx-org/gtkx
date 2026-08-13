import { copy, type Descriptor } from "@gtkx/native";
import type { CallbackDescriptor, RefDescriptor } from "./descriptors.js";
import { foldedLengthSources, type LengthSource, type LengthSources } from "./folded-lengths.js";
import { fromNative, toNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";
import { copyValue } from "./value.js";
import { popSeedFrame, pushSeedFrame, type RefSeeds } from "./vfunc-seeds.js";

type Callback = (...args: unknown[]) => unknown;
type CallbackKind = "vfunc" | "signal" | "callback";
type CallbackTraits = { isInstanceBound: boolean; hasInstanceArg: boolean; hasFoldedLengths: boolean };
type OutParam = { value: unknown; descriptor: Descriptor; argIndex: number };
type LengthLink = { target: OutParam; sources: LengthSource[] };
type OutParamGroups = { lengthLinks: LengthLink[]; valueParams: OutParam[] };
type OutValues = Map<number, unknown>;

type CallbackSpec = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number;
};

type CallbackPlan = {
    fn: Callback;
    effectiveTypes: Descriptor[];
    returnDescriptor: Descriptor;
    hasPrimary: boolean;
    start: number;
    isInstanceBound: boolean;
    lengthSources: LengthSources;
    hasOutParams: boolean;
    hasRefOutParams: boolean;
};

const CALLBACK_TRAITS: Record<CallbackKind, CallbackTraits> = {
    callback: { isInstanceBound: false, hasInstanceArg: false, hasFoldedLengths: true },
    signal: { isInstanceBound: false, hasInstanceArg: true, hasFoldedLengths: false },
    vfunc: { isInstanceBound: true, hasInstanceArg: true, hasFoldedLengths: true },
};

const fillCallerAllocatedBuffer = (descriptor: Descriptor, target: object, source: object): void => {
    if (descriptor.kind === "boxed" && descriptor.typeName === "GValue") {
        copyValue(getHandle(target), getHandle(source));

        return;
    }

    if ((descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.size !== undefined) {
        copy(getHandle(target), getHandle(source), descriptor.size);

        return;
    }

    throw new Error(`Cannot write caller-allocated ${descriptor.kind} out-parameter: no known byte size`);
};

const isCallerAllocatedOut = (descriptor: Descriptor): boolean =>
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.isCallerAllocated === true;

const collectRefArg = (
    descriptor: RefDescriptor,
    wrappedValue: unknown,
    inputs: unknown[],
    out: { params: OutParam[]; argIndex: number },
): void => {
    if (descriptor.inout === true) {
        inputs.push((wrappedValue as { value: unknown }).value);
    }

    out.params.push({ value: wrappedValue, descriptor, argIndex: out.argIndex });
};

const collectCallbackArg = (
    descriptor: Descriptor | undefined,
    wrappedValue: unknown,
    inputs: unknown[],
    out: { params: OutParam[]; argIndex: number },
): void => {
    if (descriptor?.kind === "ref") {
        collectRefArg(descriptor, wrappedValue, inputs, out);

        return;
    }

    inputs.push(wrappedValue);

    if (descriptor !== undefined && isCallerAllocatedOut(descriptor)) {
        out.params.push({ value: wrappedValue, descriptor, argIndex: out.argIndex });
    }
};

const partitionCallbackArgs = (
    effectiveTypes: Descriptor[],
    wrapped: unknown[],
    start: number,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const params: OutParam[] = [];
    const collected = { params, argIndex: start };

    for (let i = start; i < effectiveTypes.length; i++) {
        collected.argIndex = i;
        collectCallbackArg(effectiveTypes[i], wrapped[i], inputs, collected);
    }

    return { inputs, outParams: params };
};

const hasOutParamArg = (descriptor: Descriptor | undefined): boolean =>
    descriptor !== undefined && (descriptor.kind === "ref" || isCallerAllocatedOut(descriptor));

const hasRefOutParamArg = (descriptor: Descriptor | undefined): boolean =>
    descriptor?.kind === "ref" && descriptor.inout !== true;

const haveOutParamArgs = (effectiveTypes: Descriptor[], start: number): boolean =>
    effectiveTypes.slice(start).some((descriptor) => hasOutParamArg(descriptor));

const haveRefOutParamArgs = (effectiveTypes: Descriptor[], start: number): boolean =>
    effectiveTypes.slice(start).some((descriptor) => hasRefOutParamArg(descriptor));

const groupOutParams = (outParams: OutParam[], lengthSources: LengthSources): OutParamGroups => {
    const groups: OutParamGroups = { lengthLinks: [], valueParams: [] };

    for (const outParam of outParams) {
        const sources = lengthSources.get(outParam.argIndex);

        if (sources === undefined) {
            groups.valueParams.push(outParam);
        } else {
            groups.lengthLinks.push({ target: outParam, sources });
        }
    }

    return groups;
};

const getLength = (value: unknown): number => {
    const length = (value as { length?: unknown } | null | undefined)?.length;

    return typeof length === "number" ? length : 0;
};

const lengthSourceValue = (source: LengthSource, outValues: OutValues, primary: unknown): unknown =>
    source.kind === "return" ? primary : outValues.get(source.argIndex);

const foldedLength = (sources: LengthSource[], outValues: OutValues, primary: unknown): number =>
    Math.min(...sources.map((source) => getLength(lengthSourceValue(source, outValues, primary))));

const resolveOutValues = (groups: OutParamGroups, values: unknown[], primary: unknown): OutValues => {
    const outValues: OutValues = new Map();

    for (const [position, outParam] of groups.valueParams.entries()) {
        outValues.set(outParam.argIndex, values[position]);
    }

    for (const link of groups.lengthLinks) {
        outValues.set(link.target.argIndex, foldedLength(link.sources, outValues, primary));
    }

    return outValues;
};

const writeOutParams = (outParams: OutParam[], outValues: OutValues): void => {
    for (const outParam of outParams) {
        const { descriptor } = outParam;
        const outValue = outValues.get(outParam.argIndex);

        if (descriptor.kind === "ref") {
            (outParam.value as { value: unknown }).value = toNative(descriptor.innerDescriptor, outValue);
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(descriptor, outParam.value, outValue);
        }
    }
};

const collectRefSeeds = (outParams: OutParam[]): RefSeeds => {
    const seeds: RefSeeds = new Map();

    for (const outParam of outParams) {
        const seed = (outParam.value as { value?: unknown } | null)?.value;

        if (seed != null && hasRefOutParamArg(outParam.descriptor)) {
            seeds.set(outParam.argIndex, seed);
        }
    }

    return seeds;
};

const applyCallback = (plan: CallbackPlan, thisArg: unknown, inputs: unknown[], outParams: OutParam[]): unknown => {
    if (!plan.hasRefOutParams) {
        return plan.fn.apply(thisArg, inputs);
    }

    pushSeedFrame({ argDescriptors: plan.effectiveTypes, instance: thisArg, seeds: collectRefSeeds(outParams) });

    try {
        return plan.fn.apply(thisArg, inputs);
    } finally {
        popSeedFrame();
    }
};

const getThisArg = (isInstanceBound: boolean, wrapped: unknown[]): unknown =>
    isInstanceBound ? (wrapped[0] ?? null) : null;

const wrapCallbackArgs = (effectiveTypes: Descriptor[], rawArgs: unknown[]): void => {
    let index = 0;

    for (const descriptor of effectiveTypes) {
        rawArgs[index] = fromNative(descriptor, rawArgs[index]);
        index += 1;
    }
};

const trimCallbackInputs = (plan: CallbackPlan, wrapped: unknown[]): unknown[] => {
    const count = plan.effectiveTypes.length;

    if (wrapped.length > count) {
        wrapped.length = count;
    }

    for (let index = 0; index < plan.start; index++) {
        wrapped.shift();
    }

    return wrapped;
};

const nativeReturn = (plan: CallbackPlan, primary: unknown): unknown =>
    toNative(plan.returnDescriptor, plan.hasPrimary ? primary : undefined);

const runCallback = (plan: CallbackPlan, rawArgs: unknown[]): unknown => {
    const { effectiveTypes } = plan;
    wrapCallbackArgs(effectiveTypes, rawArgs);
    const thisArg = getThisArg(plan.isInstanceBound, rawArgs);

    if (!plan.hasOutParams) {
        return nativeReturn(plan, plan.fn.apply(thisArg, trimCallbackInputs(plan, rawArgs)));
    }

    const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, rawArgs, plan.start);
    const result = applyCallback(plan, thisArg, inputs, outParams);

    if (outParams.length === 0) {
        return nativeReturn(plan, result);
    }

    const groups = groupOutParams(outParams, plan.lengthSources);
    const { primary, outValues } = splitTupleResult(result, plan.hasPrimary, groups.valueParams.length);
    writeOutParams(outParams, resolveOutValues(groups, outValues, primary));

    return nativeReturn(plan, primary);
};

const planLengthSources = (spec: CallbackSpec, hasFoldedLengths: boolean): LengthSources =>
    hasFoldedLengths ? foldedLengthSources(spec) : new Map<number, LengthSource[]>();

const getEffectiveTypes = (spec: CallbackSpec): Descriptor[] => {
    const { userDataIndex } = spec;

    if (userDataIndex === undefined) {
        return spec.argDescriptors;
    }

    return spec.argDescriptors.filter((_, i) => i !== userDataIndex);
};

const wrapCallbackValue = (spec: CallbackDescriptor, callback: unknown): unknown =>
    callback == null ? callback : wrapCallback(callback as Callback, spec, "callback");

function wrapCallback(fn: Callback, spec: CallbackSpec, kind: CallbackKind): Callback {
    const effectiveTypes = getEffectiveTypes(spec);
    const { isInstanceBound, hasInstanceArg, hasFoldedLengths } = CALLBACK_TRAITS[kind];
    const start = hasInstanceArg ? 1 : 0;

    const plan: CallbackPlan = {
        fn,
        effectiveTypes,
        returnDescriptor: spec.returnDescriptor,
        hasPrimary: spec.returnDescriptor.kind !== "void",
        start,
        isInstanceBound,
        lengthSources: planLengthSources(spec, hasFoldedLengths),
        hasOutParams: haveOutParamArgs(effectiveTypes, start),
        hasRefOutParams: haveRefOutParamArgs(effectiveTypes, start),
    };

    return (...rawArgs: unknown[]): unknown => runCallback(plan, rawArgs);
}

export { isCallerAllocatedOut, wrapCallbackValue, wrapCallback };

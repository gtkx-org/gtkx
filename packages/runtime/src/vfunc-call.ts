import type { AnyClass } from "@gtkx/utils";
import { bindVfunc, type BindVfuncOptions } from "@gtkx/native";
import { type Arg, isCallerAllocatedArg, requiresInputArg } from "./arg.js";
import { buildNativeArgTypes, fromNativeCallable } from "./fn.js";
import { foldedInputLengthSources, foldedValueLength } from "./folded-lengths.js";
import { toNative } from "./native-value.js";
import {
    getClassType,
    getHandle,
    getInterfaceVfuncRegistry,
    getVfuncRegistry,
    instanceClassName,
    resolveWrapperType,
    type VfuncDescriptor,
} from "./registry.js";
import { toAbi } from "./scalar-plan.js";
import { TYPE_INVALID, typeInterfaces, typeIsA, typeParent } from "./type.js";
import { type RefSeeds, seedsFor } from "./vfunc-seeds.js";
import { findClassVfuncDescriptor, findInterfaceVfuncDescriptor, vfuncArgs } from "./vfunc.js";

type Invoker = (instance: object, inputs: unknown[]) => unknown;
type InvokerCache = WeakMap<AnyClass, Map<string, Invoker>>;
type ResolvedSlot = { descriptor: VfuncDescriptor; interfaceType?: bigint };
type VfuncInput = { kind: "value"; arg: Arg; inputIndex: number } |
    { kind: "length"; arg: Arg; sourceInputIndex: number };

const NO_BASELINE = -1;

const SEEDED_SLOTS: Record<string, RefSeeds> = {
    "LayoutManagerClass.measure": new Map([[6, NO_BASELINE], [7, NO_BASELINE]]),
    "WidgetClass.measure": new Map([[5, NO_BASELINE], [6, NO_BASELINE]]),
};

const parentInvokers: InvokerCache = new WeakMap();
const vfuncInvokers: InvokerCache = new WeakMap();

function toNativeInput(arg: Arg, input: unknown): unknown {
    return isCallerAllocatedArg(arg) ? input : toNative(arg.type, input);
}

function vfuncInputs(args: Arg[], descriptor: VfuncDescriptor): VfuncInput[] {
    const sources = foldedInputLengthSources(descriptor);
    const required = args
        .map((arg, descriptorIndex) => ({ arg, descriptorIndex }))
        .filter(({ arg }) => requiresInputArg(arg))
        .slice(1);
    const publicInputIndex = (descriptorIndex: number): number =>
        required.filter((input) => input.descriptorIndex < descriptorIndex && !sources.has(input.descriptorIndex))
            .length;

    return required.map(({ arg, descriptorIndex }) => {
        const sourceDescriptorIndex = sources.get(descriptorIndex);

        if (sourceDescriptorIndex === undefined) {
            return { kind: "value", arg, inputIndex: publicInputIndex(descriptorIndex) };
        }

        return { kind: "length", arg, sourceInputIndex: publicInputIndex(sourceDescriptorIndex) };
    });
}

const marshalVfuncInput = (input: VfuncInput, values: unknown[]): unknown =>
    toNativeInput(
        input.arg,
        input.kind === "value" ? values[input.inputIndex] : foldedValueLength(values[input.sourceInputIndex]),
    );

function bindOptionsFor(
    slot: ResolvedSlot,
    instanceType: bigint | undefined,
    args: Arg[],
    label: string,
): BindVfuncOptions {
    const { descriptor, interfaceType } = slot;

    const options: BindVfuncOptions = {
        byteOffset: descriptor.byteOffset,
        label,
        argDescriptors: buildNativeArgTypes(args, descriptor.canThrow === true).map((descriptor) => toAbi(descriptor)),
        returnDescriptor: toAbi(descriptor.returnDescriptor),
    };

    if (descriptor.vtableSize !== undefined) {
        options.vtableSize = descriptor.vtableSize;
    }

    if (instanceType !== undefined) {
        options.instanceType = instanceType;
    }

    if (interfaceType !== undefined) {
        options.interfaceType = interfaceType;
    }

    return options;
}

function buildInvoker(slot: ResolvedSlot, instanceType: bigint | undefined, caller: string): Invoker {
    const { descriptor } = slot;

    if (descriptor.canCall === false) {
        throw new Error(`${caller}: ${descriptor.className}.${descriptor.vfuncName} cannot be called`);
    }

    const args = vfuncArgs(descriptor);
    const canThrow = descriptor.canThrow === true;
    const label = `${descriptor.className}.${descriptor.vfuncName}`;
    const inputPlan = vfuncInputs(args, descriptor);
    const inputCount = inputPlan.filter((input) => input.kind === "value").length;
    let pendingSeeds: RefSeeds | undefined;

    const takeRefSeeds = (): RefSeeds | undefined => {
        const seeds = pendingSeeds;
        pendingSeeds = undefined;

        return seeds;
    };

    const shaped = fromNativeCallable(
        bindVfunc(bindOptionsFor(slot, instanceType, args, label)),
        {
            args,
            returns: descriptor.returnDescriptor,
            canThrow,
        },
        takeRefSeeds,
    );

    return (instance, inputs) => {
        if (inputs.length !== inputCount) {
            throw new Error(
                `${caller}: ${label} expects ${String(inputCount)} arguments, ` +
                `received ${String(inputs.length)}`,
            );
        }

        const nativeInputs = inputPlan.map((input) => marshalVfuncInput(input, inputs));
        pendingSeeds = SEEDED_SLOTS[label] ?? seedsFor(descriptor.argDescriptors, instance);

        return shaped(getHandle(instance), ...nativeInputs);
    };
}

function cachedInvoker(cache: InvokerCache, owner: AnyClass, key: string, build: () => Invoker): Invoker {
    const byKey = cache.getOrInsertComputed(owner, () => new Map<string, Invoker>());

    return byKey.getOrInsertComputed(key, build);
}

function resolveParentSlot(klass: AnyClass, parentType: bigint, methodName: string): ResolvedSlot | undefined {
    const classDescriptor = findClassVfuncDescriptor(klass, methodName);

    if (classDescriptor) {
        return { descriptor: classDescriptor };
    }

    for (const interfaceType of typeInterfaces(parentType)) {
        const descriptor = findInterfaceVfuncDescriptor(interfaceType, methodName);

        if (descriptor) {
            return { descriptor, interfaceType };
        }
    }

    return undefined;
}

function resolveParentType(klass: AnyClass, methodName: string): bigint {
    const gtype = getClassType(klass);

    if (gtype === TYPE_INVALID) {
        throw new Error(
            `callParent: cannot call '${methodName}' because ${klass.name} was never passed to registerClass`,
        );
    }

    return typeParent(gtype);
}

function buildParentInvoker(klass: AnyClass, methodName: string): Invoker {
    const parentType = resolveParentType(klass, methodName);
    const slot = resolveParentSlot(klass, parentType, methodName);

    if (!slot) {
        throw new Error(`callParent: ${klass.name} inherits no '${methodName}' vtable slot`);
    }

    return buildInvoker(slot, parentType, "callParent");
}

/**
 * Calls a parent virtual function from an override.
 *
 * Use the lexical class declaring the override as `klass`, not the instance's runtime class,
 * so each override advances exactly one level. Arguments follow the override convention:
 * pure out parameters are omitted and returned instead, with multiple outputs forming a tuple.
 *
 * @param klass Registered class whose override is chaining up.
 * @param methodName Overridden method, such as `vfuncMeasure`.
 * @param instance Instance passed to the override.
 * @param inputs Arguments passed to the override.
 * @throws If `klass` is unregistered, inherits no matching slot, or has an empty parent slot.
 */
function callParent(klass: AnyClass, methodName: string, instance: object, ...inputs: unknown[]): unknown {
    const invoker = cachedInvoker(parentInvokers, klass, methodName, () => buildParentInvoker(klass, methodName));

    return invoker(instance, inputs);
}

function resolveOwnerSlot(owner: AnyClass, key: string): ResolvedSlot {
    const classDescriptor = getVfuncRegistry(owner)?.[key];

    if (classDescriptor !== undefined) {
        return { descriptor: classDescriptor };
    }

    const interfaceType = getClassType(owner);
    const descriptor = getInterfaceVfuncRegistry(interfaceType)?.[key];

    if (descriptor === undefined) {
        throw new Error(`callVfunc: ${owner.name} declares no '${key}' vtable slot`);
    }

    return { descriptor, interfaceType };
}

function requiresDefaultVtable(slot: ResolvedSlot, instanceType: bigint): boolean {
    return slot.interfaceType !== undefined && !typeIsA(instanceType, slot.interfaceType);
}

function resolveInstanceType(key: string, instance: object, slot: ResolvedSlot): bigint | undefined {
    const instanceType = resolveWrapperType(instance);

    if (instanceType === TYPE_INVALID) {
        const name = instanceClassName(instance);
        throw new Error(`callVfunc: cannot call '${key}' because ${name} descends from no registered wrapper class`);
    }

    return requiresDefaultVtable(slot, instanceType) ? undefined : instanceType;
}

/**
 * Calls a virtual-function slot for a generated `vfunc` member.
 *
 * @remarks
 * The slot comes from the nearest generated wrapper in the instance's ancestry, so `super`
 * calls the replaced implementation without re-entering the override. If that wrapper does
 * not implement the interface owning the slot, use the interface's default vtable: a subclass
 * adopted the interface, replacing that default.
 *
 * Arguments follow the override convention. Pure out parameters are omitted and returned
 * instead; multiple outputs form a tuple.
 *
 * @param owner Wrapper class or interface declaring the slot.
 * @param key Generated member name, such as `vfuncMeasure`.
 * @param instance Instance to invoke the slot on.
 * @param inputs Arguments passed to the slot.
 * @throws If the owner declares no matching slot, the instance has no wrapper ancestor,
 * or the resolved vtable slot is empty.
 */
function callVfunc(owner: AnyClass, key: string, instance: object, inputs: unknown[]): unknown {
    const slot = resolveOwnerSlot(owner, key);
    const instanceType = resolveInstanceType(key, instance, slot);

    const invoker = cachedInvoker(vfuncInvokers, owner, `${key}:${String(instanceType)}`, () =>
        buildInvoker(slot, instanceType, "callVfunc"));

    return invoker(instance, inputs);
}

export { callParent, callVfunc };

import type { BindVfuncOptions } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { bindVfunc } from "@gtkx/native";
import { type Arg, isCallerAllocatedArg, requiresInputArg } from "./arg.js";
import { buildNativeArgTypes, fromNativeCallable } from "./fn.js";
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
import { TYPE_INVALID, typeInterfaces, typeIsA, typeParent } from "./type.js";
import { findClassVfuncDescriptor, findInterfaceVfuncDescriptor, vfuncArgs } from "./vfunc.js";

type Invoker = (instance: object, inputs: unknown[]) => unknown;
type InvokerCache = WeakMap<AnyClass, Map<string, Invoker>>;
type ResolvedSlot = { descriptor: VfuncDescriptor; interfaceType?: bigint };

const parentInvokers: InvokerCache = new WeakMap();
const vfuncInvokers: InvokerCache = new WeakMap();

function toNativeInput(arg: Arg, input: unknown): unknown {
    return isCallerAllocatedArg(arg) ? input : toNative(arg.type, input);
}

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
        argDescriptors: buildNativeArgTypes(args, descriptor.canThrow === true),
        returnDescriptor: descriptor.returnDescriptor,
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
    const args = vfuncArgs(descriptor);
    const canThrow = descriptor.canThrow === true;
    const label = `${descriptor.className}.${descriptor.vfuncName}`;
    const [, ...inputArgs] = args.filter(requiresInputArg);

    const shaped = fromNativeCallable(bindVfunc(bindOptionsFor(slot, instanceType, args, label)), {
        args,
        returns: descriptor.returnDescriptor,
        canThrow,
    });

    return (instance, inputs) => {
        if (inputs.length !== inputArgs.length) {
            throw new Error(
                `${caller}: ${label} expects ${String(inputArgs.length)} arguments, ` +
                `received ${String(inputs.length)}`,
            );
        }

        return shaped(getHandle(instance), ...inputArgs.map((arg, index) => toNativeInput(arg, inputs[index])));
    };
}

function cachedInvoker(cache: InvokerCache, owner: AnyClass, key: string, build: () => Invoker): Invoker {
    let byKey = cache.get(owner);

    if (byKey === undefined) {
        byKey = new Map();
        cache.set(owner, byKey);
    }

    let invoker = byKey.get(key);

    if (invoker === undefined) {
        invoker = build();
        byKey.set(key, invoker);
    }

    return invoker;
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
 * Calls the implementation of a virtual function that the parent type of `klass` provides, so an
 * override can chain up to the behavior it replaces. `klass` is the class whose override is
 * running, named lexically rather than taken from `instance`, so each level of a hierarchy reaches
 * exactly one level up. Arguments and the return value follow the same convention the override
 * itself uses: pure out parameters are left out and returned instead, and a slot with several
 * outputs returns them as a tuple. Throws if `klass` was never registered, inherits no such slot,
 * or the parent type leaves the slot empty.
 *
 * @param klass The registered class whose override is chaining up.
 * @param methodName Name of the overridden method, such as `vfuncMeasure`.
 * @param instance The instance the override was invoked on.
 * @param inputs The arguments the override received.
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
 * Calls the implementation of a virtual function a wrapper class or interface declares, backing the
 * `vfunc`-prefixed members the generated bindings emit. The slot is read from the nearest generated
 * wrapper class in the instance's class chain rather than from the instance's own type, so an
 * override reaching it through `super` runs the implementation it replaced instead of re-entering
 * itself. When that wrapper class does not carry the interface the slot belongs to, because a class
 * registered below it adopted the interface, the slot comes from the interface's own default vtable
 * instead, which holds exactly what the adopting class replaced. Arguments and the return value
 * follow the same convention an override uses: pure out parameters are left out and returned
 * instead, and a slot with several outputs returns them as a tuple. Throws if the owner declares no
 * such slot, the instance descends from no wrapper class, or the resolved vtable leaves the slot
 * empty.
 *
 * @param owner The wrapper class or interface declaring the slot.
 * @param key Name of the generated member, such as `vfuncMeasure`.
 * @param instance The instance to invoke the slot on.
 * @param inputs The arguments the slot receives.
 */
function callVfunc(owner: AnyClass, key: string, instance: object, inputs: unknown[]): unknown {
    const slot = resolveOwnerSlot(owner, key);
    const instanceType = resolveInstanceType(key, instance, slot);

    const invoker = cachedInvoker(vfuncInvokers, owner, `${key}:${String(instanceType)}`, () =>
        buildInvoker(slot, instanceType, "callVfunc"));

    return invoker(instance, inputs);
}

export { callParent, callVfunc };

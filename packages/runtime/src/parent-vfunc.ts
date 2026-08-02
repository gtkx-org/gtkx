import type { BindVfuncOptions } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type Arg, isCallerAllocatedArg, requiresInputArg } from "./arg.js";
import { bindVfunc } from "./bind.js";
import { buildNativeArgTypes, fromNativeCallable } from "./fn.js";
import { toNative } from "./native-value.js";
import { getClassType, getHandle } from "./registry.js";
import { TYPE_INVALID, typeInterfaces, typeParent } from "./type.js";
import { type AnyVfuncDescriptor, findClassVfuncDescriptor, findInterfaceVfuncDescriptor, vfuncArgs } from "./vfunc.js";

type ParentInvoker = (instance: object, inputs: unknown[]) => unknown;
type ResolvedSlot = { descriptor: AnyVfuncDescriptor; interfaceType?: bigint };

const invokerCache: WeakMap<AnyClass, Map<string, ParentInvoker>> = new WeakMap();

function resolveSlot(klass: AnyClass, parentType: bigint, methodName: string): ResolvedSlot | undefined {
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

function toNativeInput(arg: Arg, input: unknown): unknown {
    return isCallerAllocatedArg(arg) ? input : toNative(arg.type, input);
}

function buildInvoker(klass: AnyClass, methodName: string): ParentInvoker {
    const parentType = resolveParentType(klass, methodName);
    const slot = resolveSlot(klass, parentType, methodName);

    if (!slot) {
        throw new Error(`callParent: ${klass.name} inherits no '${methodName}' vtable slot`);
    }

    const { descriptor, interfaceType } = slot;
    const args = vfuncArgs(descriptor);
    const label = `${descriptor.className}.${descriptor.vfuncName}`;
    const [, ...inputArgs] = args.filter(requiresInputArg);

    const options: BindVfuncOptions = {
        instanceType: parentType,
        byteOffset: descriptor.byteOffset,
        vtableSize: descriptor.vtableSize,
        label,
        argDescriptors: buildNativeArgTypes(args, false),
        returnDescriptor: descriptor.returnDescriptor,
    };

    if (interfaceType !== undefined) {
        options.interfaceType = interfaceType;
    }

    const shaped = fromNativeCallable(bindVfunc(options), { args, returns: descriptor.returnDescriptor });

    return (instance, inputs) => {
        if (inputs.length !== inputArgs.length) {
            throw new Error(
                `callParent: ${label} expects ${String(inputArgs.length)} arguments, ` +
                `received ${String(inputs.length)}`,
            );
        }

        return shaped(getHandle(instance), ...inputArgs.map((arg, index) => toNativeInput(arg, inputs[index])));
    };
}

function getInvoker(klass: AnyClass, methodName: string): ParentInvoker {
    let byMethodName = invokerCache.get(klass);

    if (byMethodName === undefined) {
        byMethodName = new Map();
        invokerCache.set(klass, byMethodName);
    }

    let invoker = byMethodName.get(methodName);

    if (invoker === undefined) {
        invoker = buildInvoker(klass, methodName);
        byMethodName.set(methodName, invoker);
    }

    return invoker;
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
 * @param methodName Name of the overridden method, as the wrapper class declares it.
 * @param instance The instance the override was invoked on.
 * @param inputs The arguments the override received.
 */
function callParent(klass: AnyClass, methodName: string, instance: object, ...inputs: unknown[]): unknown {
    return getInvoker(klass, methodName)(instance, inputs);
}

export { callParent };

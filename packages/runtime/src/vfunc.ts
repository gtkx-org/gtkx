import type { Descriptor } from "@gtkx/native";
import { type AnyClass, getParentClass, walkClassChain } from "@gtkx/utils";
import type { Arg } from "./arg.js";
import { isCallerAllocatedOut } from "./callback.js";
import { foldedLengthSources } from "./folded-lengths.js";
import { getInterfaceVfuncRegistry, getVfuncRegistry, type VfuncDescriptor } from "./registry.js";

function findClassVfuncDescriptor(klass: AnyClass, methodName: string): VfuncDescriptor | null {
    return walkClassChain(getParentClass(klass), (cls) => getVfuncRegistry(cls)?.[methodName]) ?? null;
}

function findInterfaceVfuncDescriptor(interfaceGtype: bigint, methodName: string): VfuncDescriptor | undefined {
    return getInterfaceVfuncRegistry(interfaceGtype)?.[methodName];
}

function vfuncArg(descriptor: Descriptor, isFoldedLength: boolean): Arg {
    if (descriptor.kind === "ref") {
        return {
            type: descriptor.innerDescriptor,
            direction: descriptor.inout === true ? "inout" : "out",
            isConsumed: isFoldedLength,
        };
    }

    if (isCallerAllocatedOut(descriptor)) {
        return { type: descriptor, direction: "out", isCallerAllocated: true };
    }

    return { type: descriptor };
}

function vfuncArgs(descriptor: VfuncDescriptor): Arg[] {
    const lengths = foldedLengthSources(descriptor);

    return descriptor.argDescriptors.map((argDescriptor, index) => vfuncArg(argDescriptor, lengths.has(index)));
}

export { findClassVfuncDescriptor, findInterfaceVfuncDescriptor, vfuncArgs };

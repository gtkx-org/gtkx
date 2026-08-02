import type { Descriptor } from "@gtkx/native";
import { type AnyClass, getParentClass, walkClassChain } from "@gtkx/utils";
import type { Arg } from "./arg.js";
import { getInterfaceVfuncRegistry, getVfuncRegistry, type VfuncDescriptor } from "./registry.js";

type AnyVfuncDescriptor = VfuncDescriptor<"class" | "interface">;

function findClassVfuncDescriptor(klass: AnyClass, methodName: string): VfuncDescriptor<"class"> | null {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const entry = getVfuncRegistry(cls)?.[methodName];

            return entry?.kind === "class" ? entry : undefined;
        }) ?? null
    );
}

function findInterfaceVfuncDescriptor(
    interfaceGtype: bigint,
    methodName: string,
): VfuncDescriptor<"interface"> | undefined {
    const entry = getInterfaceVfuncRegistry(interfaceGtype)?.[methodName];

    return entry?.kind === "interface" ? entry : undefined;
}

function isCallerAllocatedDescriptor(descriptor: Descriptor): boolean {
    return (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.isCallerAllocated === true;
}

function vfuncArg(descriptor: Descriptor): Arg {
    if (descriptor.kind === "ref") {
        return { type: descriptor.innerDescriptor, direction: descriptor.inout === true ? "inout" : "out" };
    }

    if (isCallerAllocatedDescriptor(descriptor)) {
        return { type: descriptor, direction: "out", isCallerAllocated: true };
    }

    return { type: descriptor };
}

function vfuncArgs(descriptor: AnyVfuncDescriptor): Arg[] {
    return descriptor.argDescriptors.map((argDescriptor) => vfuncArg(argDescriptor));
}

export { findClassVfuncDescriptor, findInterfaceVfuncDescriptor, vfuncArgs, type AnyVfuncDescriptor };

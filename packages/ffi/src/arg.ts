import type { Descriptor } from "@gtkx/native";
import type { RefDescriptor } from "./descriptors.js";

type DirectedArg = { direction?: "out" | "inout"; callerAllocated?: boolean };

export const isOutputArg = (arg: DirectedArg): boolean => arg.direction !== undefined;

export const isInoutArg = (arg: DirectedArg): boolean => arg.direction === "inout";

export const isCallerAllocatedArg = (arg: DirectedArg): boolean => arg.callerAllocated === true;

export const isRefArg = (arg: DirectedArg): boolean => arg.direction !== undefined && arg.callerAllocated !== true;

export const isRefDescriptor = (descriptor: Descriptor): descriptor is RefDescriptor => descriptor.kind === "ref";

export const isCallerAllocatedType = (descriptor: Descriptor): boolean =>
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.callerAllocated === true;

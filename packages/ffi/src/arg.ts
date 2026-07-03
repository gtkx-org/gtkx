import type { Descriptor } from "@gtkx/native";
import type { RefDescriptor } from "./descriptors.js";

type Arg = { direction?: "out" | "inout"; callerAllocated?: boolean };

export const isOutputArg = (arg: Arg): boolean => arg.direction !== undefined;

export const isInoutArg = (arg: Arg): boolean => arg.direction === "inout";

export const isCallerAllocatedArg = (arg: Arg): boolean => arg.callerAllocated === true;

export const isRefArg = (arg: Arg): boolean => arg.direction !== undefined && arg.callerAllocated !== true;

export const isRefDescriptor = (descriptor: Descriptor): descriptor is RefDescriptor => descriptor.kind === "ref";

export const isCallerAllocatedDescriptor = (descriptor: Descriptor): boolean =>
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.callerAllocated === true;

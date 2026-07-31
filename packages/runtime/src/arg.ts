import type { Descriptor } from "@gtkx/native";

/** How one argument of a native call or signal emission is marshalled and which way it flows. */
type Arg = {
    /** Descriptor the value is marshalled with, wrapped in a pointer to it for an output argument. */
    type: Descriptor;
    /** Direction of an output argument, omitted for a plain input argument. */
    direction?: "out" | "inout";
    /** When true, the caller supplies the storage the callee writes into, rather than a pointer to fill. */
    callerAllocated?: boolean;
    /** When true, the argument is consumed internally and left out of the packed result. */
    consumed?: boolean;
};

const isOutputArg = (arg: Arg): boolean => arg.direction !== undefined;
const isInoutArg = (arg: Arg): boolean => arg.direction === "inout";
const isCallerAllocatedArg = (arg: Arg): boolean => arg.callerAllocated === true;
const isRefArg = (arg: Arg): boolean => arg.direction !== undefined && arg.callerAllocated !== true;

export { isOutputArg, isInoutArg, isCallerAllocatedArg, isRefArg, type Arg };

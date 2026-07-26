import type { Descriptor } from "@gtkx/native";

type Arg = {
    type: Descriptor;
    direction?: "out" | "inout";
    callerAllocated?: boolean;
    consumed?: boolean;
};

const isOutputArg = (arg: Arg): boolean => arg.direction !== undefined;
const isInoutArg = (arg: Arg): boolean => arg.direction === "inout";
const isCallerAllocatedArg = (arg: Arg): boolean => arg.callerAllocated === true;
const isRefArg = (arg: Arg): boolean => arg.direction !== undefined && arg.callerAllocated !== true;

export { isOutputArg, isInoutArg, isCallerAllocatedArg, isRefArg, type Arg };

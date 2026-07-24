import type { Arg, BuildArg, Call, ListProp } from "@gtkx/config";

export const isBuildArg = (arg: Arg): arg is BuildArg => typeof arg === "object" && "build" in arg;

export const addCalls = (add: ListProp["add"]): Call[] => (Array.isArray(add) ? [...add] : [add]);

export const buildArgsOf = (prop: ListProp): BuildArg[] =>
    addCalls(prop.add).flatMap((call) => (typeof call === "string" ? [] : call.args.filter(isBuildArg)));

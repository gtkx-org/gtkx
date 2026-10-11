import { init } from "@gtkx/native";

const DISPATCH_BUDGET_MS = 4;

init(DISPATCH_BUDGET_MS);

export * from "@gtkx/native";
export * from "@gtkx/native/internal";
export {
    bind,
    bindFunctionPointer,
    bindVfunc,
    call,
    resolveFunction,
    resolveFunctionOptional,
} from "./native-bindings.js";
export type { BoundCall, BindVfuncOptions } from "./native-bindings.js";

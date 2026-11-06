import { init } from "@gtkx/native";

const DISPATCH_BUDGET_MS = 4;
const EVALUATED_KEY = Symbol.for("gtkx:runtime");

if (Reflect.has(globalThis, EVALUATED_KEY)) {
    throw new Error(
        "@gtkx/runtime was evaluated a second time in this process, so GTKX code loaded from now on would not share its widgets, signals and types with the first copy. " +
            "In Vitest this happens when a test calls vi.resetModules() and then imports GTKX code again; keep module-level state behind a function or a prop instead. " +
            "Otherwise, check that the application installs a single copy of @gtkx/runtime.",
    );
}

init(DISPATCH_BUDGET_MS);
Reflect.set(globalThis, EVALUATED_KEY, true);

export * from "@gtkx/native";
export {
    bind,
    bindFunctionPointer,
    bindVfunc,
    call,
    resolveFunction,
    resolveFunctionOptional,
} from "./native-bindings.js";
export type { BoundCall, BindVfuncOptions } from "./native-bindings.js";

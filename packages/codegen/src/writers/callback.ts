import type { ModuleContext } from "../dsl/context.js";
import type { GirCallback } from "../gir/callback.js";
import type { GirFunction } from "../gir/function.js";
import { renderMethodReturnType, renderMethodSignature } from "./method.js";

const callbackAsFunction = (callback: GirCallback): GirFunction => ({
    kind: "function",
    name: callback.name,
    cIdentifier: undefined,
    throws: false,
    introspectable: callback.introspectable,
    shadowedBy: undefined,
    instance: undefined,
    parameters: callback.parameters,
    returnValue: callback.returnValue,
});

/**
 * Emits an `export type` alias for a top-level GIR `<callback>`.
 *
 * The callback is surfaced under its GIR `name` verbatim with a fully typed
 * call signature: input parameters follow {@link renderMethodSignature} (the
 * folded `user_data`/`GDestroyNotify` slots are dropped) and the return follows
 * {@link renderMethodReturnType}, so out-parameters tuple into the return the
 * same way a method's would.
 *
 * @param context - The module context
 * @param callback - The callback to emit
 */
export const emitCallback = (context: ModuleContext, callback: GirCallback): void => {
    if (!callback.introspectable) return;
    if (callback.name.length === 0) return;
    const fn = callbackAsFunction(callback);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    context.module.appendDeclaration(`export type ${callback.name} = (${signature}) => ${returnType};`);
};

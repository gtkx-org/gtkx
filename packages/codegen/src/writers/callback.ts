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

export const emitCallback = (context: ModuleContext, callback: GirCallback): void => {
    if (!callback.introspectable) return;
    if (callback.name.length === 0) return;
    const fn = callbackAsFunction(callback);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    context.module.appendDeclaration(`export type ${callback.name} = (${signature}) => ${returnType};`);
};

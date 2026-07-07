import type { GirCallback } from "../../gir/callback.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderMethodReturnType, renderMethodSignature } from "./method.js";

const callbackAsFunction = (callback: GirCallback): GirFunction => ({
    name: callback.name,
    cIdentifier: undefined,
    throws: false,
    introspectable: callback.introspectable,
    shadowedBy: undefined,
    instance: undefined,
    parameters: callback.parameters,
    returnValue: callback.returnValue,
});

export const generateCallback = (context: ModuleContext, callback: GirCallback): void => {
    if (!callback.introspectable) return;
    if (callback.name.length === 0) return;
    const fn = callbackAsFunction(callback);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    context.module.appendDeclaration(`export type ${callback.name} = (${signature}) => ${returnType};`);
};

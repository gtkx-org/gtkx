import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { callbackAsFunction, type GirCallback } from "../../gir/callback.js";
import { callableDoc } from "./callable-doc.js";
import { renderMethodReturnType, renderMethodSignature } from "./method.js";

const generateCallback = (context: ModuleContext, callback: GirCallback): void => {
    if (!callback.introspectable) {
        return;
    }

    if (callback.name.length === 0) {
        return;
    }

    const fn = callbackAsFunction(callback);
    const signature = renderMethodSignature(context, fn);
    const returnType = renderMethodReturnType(context, fn);
    const name = sanitizeTypeIdentifier(callback.name);

    context.declare({
        name,
        code: `${callableDoc(context, fn)}export type ${name} = (${signature}) => ${returnType};`,
        owner: callback.name,
    });
};

export { generateCallback };

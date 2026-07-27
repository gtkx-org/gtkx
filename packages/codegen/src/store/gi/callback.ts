import type { ModuleContext } from "../../writer/context.js";
import { callbackAsFunction, type GirCallback } from "../../gir/callback.js";
import { renderJsDoc } from "../../writer/doc.js";
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

    context.module.appendDeclaration(
        `${renderJsDoc(callback.doc)}export type ${callback.name} = (${signature}) => ${returnType};`,
    );
};

export { generateCallback };

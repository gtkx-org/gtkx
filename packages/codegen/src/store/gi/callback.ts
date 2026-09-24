import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { ModuleContext } from "../../writer/context.js";
import { callbackIgnoredParameters, isSupportedCallback } from "../../analysis/callback-shape.js";
import { callbackAsFunction, type GirCallback } from "../../gir/callback.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { callableDoc } from "./callable-doc.js";
import { renderMethodReturnType, renderMethodSignature } from "./method.js";

type CallbackSignature = {
    fn: GirFunction;
    options: { excludedParameters: ReadonlySet<GirParameter> };
    signature: string;
    returnType: string;
};

const callbackSignature = (context: ModuleContext, callback: GirCallback): CallbackSignature => {
    const fn = callbackAsFunction(callback);
    const excludedParameters = callbackIgnoredParameters(context.library, callback);

    return {
        fn,
        options: { excludedParameters },
        signature: renderMethodSignature(context, fn, excludedParameters, "from-native"),
        returnType: renderMethodReturnType(context, fn, { excludedParameters, direction: "to-native" }),
    };
};

const generateCallback = (context: ModuleContext, callback: GirCallback): void => {
    if (!isEmittableEntity(callback) || !isSupportedCallback(context.library, callback)) {
        return;
    }

    const { fn, options, signature, returnType } = callbackSignature(context, callback);
    const name = sanitizeTypeIdentifier(callback.name);

    context.declare({
        name,
        code: `${callableDoc(context, fn, options)}export type ${name} = (${signature}) => ${returnType};`,
        owner: callback.name,
    });
};

export { callbackSignature, generateCallback };

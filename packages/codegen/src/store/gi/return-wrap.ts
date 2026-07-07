import { renderDescriptor } from "../../analysis/descriptor-render.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";

type WrapReturnOptions = {
    ref: TypeId | undefined;
    nullable: boolean;
    valueExpression: string;
};

export const wrapReturnValue = (context: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, nullable, valueExpression } = options;
    if (ref === undefined) return valueExpression;
    const type = context.library.typeOf(ref);
    if (type === undefined) return wrapValue(context, ref, valueExpression);
    switch (type.kind) {
        case "primitive":
            return wrapPrimitive(type.category, nullable, valueExpression);
        case "varargs":
            return `(${valueExpression} as unknown[])`;
        case "callback":
            return context.library.nameOf(ref) === undefined ? `(${valueExpression} as unknown[])` : valueExpression;
        case "enum":
            return `(${valueExpression} as number)`;
        case "alias":
            return type.value.target === undefined
                ? valueExpression
                : wrapReturnValue(context, { ref: type.value.target, nullable, valueExpression });
        default:
            return wrapValue(context, ref, valueExpression);
    }
};

const wrapValue = (context: ModuleContext, ref: TypeId, valueExpression: string): string => {
    context.addRuntimeImport("fromNative");
    const descriptor = context.hoistDescriptor(renderDescriptor(context, ref, "none"));
    return `fromNative(${descriptor}, ${valueExpression})`;
};

const wrapPrimitive = (category: PrimitiveCategory, nullable: boolean, valueExpression: string): string => {
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    if (category === "gtype" || category === "bigint64" || category === "biguint64") {
        return `(${valueExpression} as bigint)`;
    }
    return `(${valueExpression} as number)`;
};

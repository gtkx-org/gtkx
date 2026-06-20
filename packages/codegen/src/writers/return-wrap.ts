import type { ModuleContext } from "../dsl/context.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { TypeId } from "../gir/type-id.js";
import { renderFfiType } from "./value.js";

export type WrapReturnOptions = {
    ref: TypeId | undefined;
    nullable: boolean;
    valueExpression: string;
};

export const wrapReturnValue = (context: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, nullable, valueExpression } = options;
    if (ref === undefined) return valueExpression;
    const type = context.repository.typeOf(ref);
    if (type === undefined) return wrapViaFfiValue(context, ref, valueExpression);
    switch (type.kind) {
        case "primitive":
            return wrapPrimitive(type.category, nullable, valueExpression);
        case "varargs":
            return `(${valueExpression} as unknown[])`;
        case "callback":
            return context.repository.nameOf(ref) === undefined ? `(${valueExpression} as unknown[])` : valueExpression;
        case "enum":
            return `(${valueExpression} as number)`;
        case "alias":
            return type.target === undefined
                ? valueExpression
                : wrapReturnValue(context, { ref: type.target, nullable, valueExpression });
        default:
            return wrapViaFfiValue(context, ref, valueExpression);
    }
};

const wrapViaFfiValue = (context: ModuleContext, ref: TypeId, valueExpression: string): string => {
    context.addRuntimeImport("wrapValue");
    const descriptor = context.hoistFfiType(renderFfiType(context, ref, "none"));
    return `wrapValue(${descriptor}, ${valueExpression})`;
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

import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";

type WrapReturnOptions = {
    ref: TypeId | undefined;
    isNullable: boolean;
    valueExpression: string;
};

const BIGINT_CATEGORIES: Set<PrimitiveCategory> = new Set(["gtype", "bigint64", "biguint64"]);

const wrapReturnValue = (context: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, isNullable, valueExpression } = options;

    if (ref === undefined) {
        return valueExpression;
    }

    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return wrapValue(context, ref, valueExpression);
    }

    switch (type.kind) {
        case "primitive": {
            return wrapPrimitive(type.category, isNullable, valueExpression);
        }
        case "varargs": {
            return `(${valueExpression} as unknown[])`;
        }
        case "callback": {
            return wrapCallback(context, ref, valueExpression);
        }
        case "enum": {
            return `(${valueExpression} as number)`;
        }
        case "alias": {
            return wrapAlias(context, type.value.target, isNullable, valueExpression);
        }
        case "carray":
        case "class":
        case "hashtable":
        case "interface":
        case "list":
        case "record": {
            return wrapValue(context, ref, valueExpression);
        }
    }
};

const wrapCallback = (context: ModuleContext, ref: TypeId, valueExpression: string): string =>
    context.library.nameFor(ref) === undefined
        ? `(${valueExpression} as unknown[])`
        : `(${valueExpression} as ${renderTsType(context, ref, false)})`;

const wrapAlias = (
    context: ModuleContext,
    target: TypeId | undefined,
    isNullable: boolean,
    valueExpression: string,
): string =>
    target === undefined
        ? valueExpression
        : wrapReturnValue(context, { ref: target, isNullable, valueExpression });

const wrapValue = (context: ModuleContext, ref: TypeId, valueExpression: string): string => {
    context.addRuntimeImport("fromNative");
    const descriptor = context.hoistDescriptor(renderDescriptor(context, ref, "none"));

    return `(fromNative(${descriptor}, ${valueExpression}) as ${renderTsType(context, ref, false)})`;
};

const wrapStringPrimitive = (isNullable: boolean, valueExpression: string): string =>
    `(${valueExpression} as ${isNullable ? "string | null" : "string"})`;

const wrapPrimitive = (category: PrimitiveCategory, isNullable: boolean, valueExpression: string): string => {
    if (category === "void") {
        return valueExpression;
    }

    if (category === "string") {
        return wrapStringPrimitive(isNullable, valueExpression);
    }

    if (category === "boolean") {
        return `Boolean(${valueExpression})`;
    }

    if (BIGINT_CATEGORIES.has(category)) {
        return `(${valueExpression} as bigint)`;
    }

    return `(${valueExpression} as number)`;
};

export { wrapReturnValue };

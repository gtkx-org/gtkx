import type { GirFunction } from "../../gir/function.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { tObject } from "../../analysis/descriptor.js";
import { inputParameters, parameterIdentifier } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { resolveInterface } from "../../gir/ancestry.js";
import { callbackAsFunction, type GirCallback } from "../../gir/callback.js";

const COMPARATOR_CALLBACK_TYPES = new Set([
    "GLib.CompareFunc",
    "GLib.CompareDataFunc",
    "GLib.EqualFunc",
    "GLib.EqualFuncFull",
]);

const OBJECT_ITEM_COMPARATOR_OWNERS = new Set(["Gtk.CustomSorter"]);

const qualifiedName = (context: ModuleContext, ref: TypeId): string | undefined => {
    const name = context.library.nameFor(ref);

    return name === undefined ? undefined : `${name.namespaceName}.${name.typeName}`;
};

const isListModelImplementor = (context: ModuleContext, ref: TypeId): boolean => {
    const resolved = context.library.typeFor(ref);

    if (resolved?.kind !== "class") {
        return false;
    }

    return resolved.value.implements.some((interfaceName) => {
        const iface = resolveInterface(context.library, resolved.namespace.name, interfaceName);

        return iface?.namespaceName === "Gio" && iface.klass.name === "ListModel";
    });
};

const isObjectItemComparator = (context: ModuleContext, fn: GirFunction): boolean => {
    const ownerRef = fn.instance?.type ?? fn.returnValue.type;

    if (ownerRef === undefined) {
        return false;
    }

    const owner = qualifiedName(context, ownerRef);

    if (owner !== undefined && OBJECT_ITEM_COMPARATOR_OWNERS.has(owner)) {
        return true;
    }

    return isListModelImplementor(context, ownerRef);
};

const isItemPointer = (context: ModuleContext, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return false;
    }

    const resolved = context.library.typeFor(ref);

    return resolved?.kind === "primitive" && resolved.category === "pointer";
};

const itemComparatorCallback = (
    context: ModuleContext,
    fn: GirFunction,
    parameter: GirParameter,
): GirCallback | undefined => {
    if (parameter.type === undefined) {
        return undefined;
    }

    const resolved = context.library.typeFor(parameter.type);

    if (resolved?.kind !== "callback") {
        return undefined;
    }

    const name = qualifiedName(context, parameter.type);

    if (name === undefined || !COMPARATOR_CALLBACK_TYPES.has(name)) {
        return undefined;
    }

    return isObjectItemComparator(context, fn) ? resolved.value : undefined;
};

const itemComparatorArgDescriptors = (
    context: ModuleContext,
    fn: GirFunction,
    parameter: GirParameter,
): Map<number, string> | undefined => {
    const callback = itemComparatorCallback(context, fn, parameter);

    if (callback === undefined) {
        return undefined;
    }

    const overrides: Map<number, string> = new Map();
    const items = inputParameters(context.library, callbackAsFunction(callback));

    for (const { parameter: item, index } of items) {
        if (isItemPointer(context, item.type)) {
            overrides.set(index, tObject("borrowed"));
        }
    }

    return overrides.size > 0 ? overrides : undefined;
};

const itemComparatorTsType = (
    context: ModuleContext,
    fn: GirFunction,
    parameter: GirParameter,
): string | undefined => {
    const callback = itemComparatorCallback(context, fn, parameter);

    if (callback === undefined) {
        return undefined;
    }

    const itemType = `${context.qualify("GObject", "Object")} | null`;

    const args = inputParameters(context.library, callbackAsFunction(callback)).map(({ parameter: item, index }) => {
        const tsType = isItemPointer(context, item.type) ? itemType : renderTsType(context, item.type, item.nullable);

        return `${parameterIdentifier(item, index)}: ${tsType}`;
    });

    const returnType = renderTsType(context, callback.returnValue.type, callback.returnValue.nullable);
    const fnType = `(${args.join(", ")}) => ${returnType}`;

    return parameter.nullable ? `(${fnType}) | null` : fnType;
};

export { itemComparatorArgDescriptors, itemComparatorTsType };

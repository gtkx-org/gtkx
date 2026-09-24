import type { GirFunction } from "../../gir/function.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { callbackIgnoredParameters } from "../../analysis/callback-shape.js";
import { tObject } from "../../analysis/descriptor.js";
import { inputParameters, parameterIdentifier } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { underlyingType } from "../../analysis/type-shape.js";
import { resolveInterfaces } from "../../gir/ancestry.js";
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

    const interfaces = resolveInterfaces(context.library, resolved.namespace.name, resolved.value.implements);

    return interfaces.some((iface) => iface.namespaceName === "Gio" && iface.klass.name === "ListModel");
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

    const resolved = underlyingType(context.library, ref);

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

    const resolved = underlyingType(context.library, parameter.type);

    if (resolved?.kind !== "callback") {
        return undefined;
    }

    const name = `${resolved.namespace.name}.${resolved.value.name}`;

    if (!COMPARATOR_CALLBACK_TYPES.has(name)) {
        return undefined;
    }

    return isObjectItemComparator(context, fn) ? resolved.value : undefined;
};

const itemComparatorParameters = (
    context: ModuleContext,
    fn: GirFunction,
    parameter: GirParameter,
): ReadonlySet<GirParameter> => {
    const callback = itemComparatorCallback(context, fn, parameter);

    if (callback === undefined) {
        return new Set();
    }

    const ignored = callbackIgnoredParameters(context.library, callback);
    const items = inputParameters(context.library, callbackAsFunction(callback));

    return new Set(items
        .filter(({ parameter: item }) => !ignored.has(item) && isItemPointer(context, item.type))
        .map(({ parameter: item }) => item));
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

    const items = itemComparatorParameters(context, fn, parameter);
    const overrides: Map<number, string> = new Map();

    for (const [index, item] of callback.parameters.entries()) {
        if (items.has(item)) {
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

    const items = itemComparatorParameters(context, fn, parameter);
    const ignored = callbackIgnoredParameters(context.library, callback);
    const parameters = inputParameters(context.library, callbackAsFunction(callback))
        .filter(({ parameter: item }) => !ignored.has(item));
    const args = parameters.map(({ parameter: item, index }) => {
        const tsType = items.has(item) ? itemType : renderTsType(context, item.type, item.nullable);

        return `${parameterIdentifier(item, index)}: ${tsType}`;
    });

    const returnType = renderTsType(context, callback.returnValue.type, callback.returnValue.nullable);
    const fnType = `(${args.join(", ")}) => ${returnType}`;

    return parameter.nullable ? `(${fnType}) | null` : fnType;
};

export { itemComparatorArgDescriptors, itemComparatorParameters, itemComparatorTsType };

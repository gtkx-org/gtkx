import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { getClassType, getInstanceType, typeName } from "@gtkx/runtime";
import { resolveWrapperClass } from "@gtkx/runtime/internal";
import { type AnyClass, walkClassChain } from "@gtkx/utils";

const UNNAMED_TYPE_TAG = "Object";

const getWidgetMethod = (widget: Gtk.Widget, name: string): unknown => Reflect.get(widget, name);
const getWidgetTypeName = (widget: Gtk.Widget): string | null => typeName(getInstanceType(widget));
const nonEmpty = (value: string | null): string | undefined => (value !== null && value.length > 0 ? value : undefined);

const getNearestClassName = (object: GObject.Object): string | undefined =>
    walkClassChain((object.constructor as AnyClass | undefined) ?? null, (ancestor) => nonEmpty(ancestor.name));

const getExactWrapperName = (type: bigint): string | undefined => {
    const wrapper = resolveWrapperClass(type);

    return wrapper !== null && getClassType(wrapper) === type ? nonEmpty(wrapper.name) : undefined;
};

const getTypeTag = (object: GObject.Object): string => {
    const type = getInstanceType(object);

    return getExactWrapperName(type) ?? nonEmpty(typeName(type)) ?? getNearestClassName(object) ?? UNNAMED_TYPE_TAG;
};

const isDefaultWidgetName = (widget: Gtk.Widget, name: string): boolean =>
    name.length === 0 || name === getWidgetTypeName(widget);

const hasWidgetMethod = (widget: Gtk.Widget, name: string): boolean =>
    typeof getWidgetMethod(widget, name) === "function";

/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the signature */
const getCallableMethod = <Args extends unknown[], Result>(
    widget: Gtk.Widget,
    name: string,
): ((...args: Args) => Result) | null => {
    const fn = getWidgetMethod(widget, name);

    return typeof fn === "function" ? (fn as (...args: Args) => Result).bind(widget) : null;
};

const callBooleanGetter = (widget: Gtk.Widget, method: string): boolean | null => {
    const value = getCallableMethod<[], unknown>(widget, method)?.();

    return typeof value === "boolean" ? value : null;
};

const callStringGetter = (widget: Gtk.Widget, method: string): string | null => {
    const value = getCallableMethod<[], unknown>(widget, method)?.();

    return typeof value === "string" ? value : null;
};

export {
    callBooleanGetter,
    callStringGetter,
    getCallableMethod,
    getTypeTag,
    getWidgetTypeName,
    hasWidgetMethod,
    isDefaultWidgetName,
};

import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { type AnyClass, getClassType, getInstanceType, getWrapperClass, typeName } from "@gtkx/runtime";

const UNKNOWN_TYPE_TAG = "Object";

const getWidgetMethod = (widget: Gtk.Widget, name: string): unknown => Reflect.get(widget, name);
const getWidgetTypeName = (widget: Gtk.Widget): string | null => typeName(getInstanceType(widget));

const isExactWrapper = (wrapper: AnyClass, type: bigint): boolean =>
    wrapper.name.length > 0 && getClassType(wrapper) === type;

const getWrapperName = (object: GObject.Object): string => {
    const name = object.constructor.name;

    return name.length > 0 ? name : UNKNOWN_TYPE_TAG;
};

const getTypeTag = (object: GObject.Object): string => {
    const type = getInstanceType(object);
    const registeredName = typeName(type);

    if (registeredName === null || registeredName.length === 0) {
        return getWrapperName(object);
    }

    const wrapper = getWrapperClass(type);

    return isExactWrapper(wrapper, type) ? wrapper.name : registeredName;
};

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

export { callBooleanGetter, callStringGetter, getCallableMethod, getTypeTag, getWidgetTypeName, hasWidgetMethod };

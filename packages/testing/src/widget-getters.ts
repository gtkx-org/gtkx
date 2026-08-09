import type * as Gtk from "@gtkx/gi/gtk";

const getWidgetMethod = (widget: Gtk.Widget, name: string): unknown => Reflect.get(widget, name);

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

export { callBooleanGetter, callStringGetter, getCallableMethod, hasWidgetMethod };

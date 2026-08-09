import type * as Gtk from "@gtkx/gi/gtk";

const getWidgetMethod = (widget: Gtk.Widget, name: string): unknown => Reflect.get(widget, name);

const hasWidgetMethod = (widget: Gtk.Widget, name: string): boolean =>
    typeof getWidgetMethod(widget, name) === "function";

const callBooleanGetter = (widget: Gtk.Widget, method: string): boolean | null => {
    const fn = getWidgetMethod(widget, method);

    return typeof fn === "function" ? (fn as () => boolean).call(widget) : null;
};

const callStringGetter = (widget: Gtk.Widget, method: string): string | null => {
    const fn = getWidgetMethod(widget, method);

    if (typeof fn !== "function") {
        return null;
    }

    const value = (fn as () => string | null).call(widget);

    return value ?? null;
};

export { callBooleanGetter, callStringGetter, getWidgetMethod, hasWidgetMethod };

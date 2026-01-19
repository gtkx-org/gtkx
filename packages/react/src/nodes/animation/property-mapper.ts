import type * as Gtk from "@gtkx/ffi/gtk";

export type AnimatableProperty = "opacity" | "marginTop" | "marginBottom" | "marginStart" | "marginEnd";

type PropertyAccessor = {
    get: (widget: Gtk.Widget) => number;
    set: (widget: Gtk.Widget, value: number) => void;
};

const propertyAccessors: Record<AnimatableProperty, PropertyAccessor> = {
    opacity: {
        get: (widget) => widget.getOpacity(),
        set: (widget, value) => widget.setOpacity(value),
    },
    marginTop: {
        get: (widget) => widget.getMarginTop(),
        set: (widget, value) => widget.setMarginTop(value),
    },
    marginBottom: {
        get: (widget) => widget.getMarginBottom(),
        set: (widget, value) => widget.setMarginBottom(value),
    },
    marginStart: {
        get: (widget) => widget.getMarginStart(),
        set: (widget, value) => widget.setMarginStart(value),
    },
    marginEnd: {
        get: (widget) => widget.getMarginEnd(),
        set: (widget, value) => widget.setMarginEnd(value),
    },
};

export function getPropertyAccessor(property: AnimatableProperty): PropertyAccessor {
    return propertyAccessors[property];
}

export function isAnimatableProperty(property: string): property is AnimatableProperty {
    return property in propertyAccessors;
}

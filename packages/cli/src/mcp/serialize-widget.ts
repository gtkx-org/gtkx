import type * as Gtk from "@gtkx/gi/gtk";
import type { SerializedWidget } from "@gtkx/mcp";

export type WidgetIdResolver = (widget: Gtk.Widget) => string;

export type WidgetProjection = {
    formatRole(role: Gtk.AccessibleRole): string;
    getWidgetPropertyText(widget: Gtk.Widget): string | null;
};

export const serializeWidget = (
    widget: Gtk.Widget,
    idFor: WidgetIdResolver,
    projection: WidgetProjection,
): SerializedWidget => {
    const children: SerializedWidget[] = [];
    let child = widget.getFirstChild();
    while (child) {
        children.push(serializeWidget(child, idFor, projection));
        child = child.getNextSibling();
    }

    return {
        id: idFor(widget),
        type: widget.constructor.name,
        role: projection.formatRole(widget.getAccessibleRole()),
        name: widget.getName() || null,
        text: projection.getWidgetPropertyText(widget),
        sensitive: widget.getSensitive(),
        visible: widget.getVisible(),
        cssClasses: widget.getCssClasses() ?? [],
        children,
    };
};

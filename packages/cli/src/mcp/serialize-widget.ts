import type * as Gtk from "@gtkx/gi/gtk";
import type { SerializedWidget } from "@gtkx/mcp";

/**
 * Resolves the stable wire id for a widget.
 */
export type WidgetIdResolver = (widget: Gtk.Widget) => string;

/**
 * The `@gtkx/testing` projection helpers the serializer reuses: the lowercase
 * role formatter and the property-text reader. Supplied from the lazily loaded
 * testing module so the optional peer is never imported eagerly.
 */
export type WidgetProjection = {
    formatRole(role: Gtk.AccessibleRole): string;
    getWidgetPropertyText(widget: Gtk.Widget): string | null;
};

/**
 * Projects a widget and its descendants into the MCP wire shape, reusing
 * `@gtkx/testing`'s role formatting (lowercase) and property-text extraction so
 * the projection has one definition. Stateless: identity allocation stays with
 * the caller's {@link WidgetIdResolver}.
 *
 * @param widget - The widget to serialize.
 * @param idFor - Resolves the stable id for each widget in the tree.
 * @param projection - The testing-owned role/text helpers.
 * @returns The serialized widget tree.
 */
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

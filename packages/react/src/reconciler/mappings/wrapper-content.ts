/// <reference types="@gtkx/config/env" />

/**
 * The wrapper-content selectors shared by the reconciler's element-map
 * strategies: resolving the backing widget or instance a wrapper marker
 * contributes, and recognizing top-level surfaces that never attach as widget
 * children. Kept apart from the strategies so several mappings reuse them
 * without a back-edge through the element map.
 */
import { TOP_LEVEL_TYPES } from "virtual:gtkx-config";
import { TAB_LABEL_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { hasType } from "../../utils/gtype-predicates.js";
import { isWrapperKind, type Node, stateOf } from "../state.js";

/** Whether `widget` is a top-level surface per the `TOP_LEVEL_TYPES` table. */
export const isTopLevelSurface = (widget: GObject.Object): boolean =>
    TOP_LEVEL_TYPES.some((typeName) => hasType(widget, typeName));

/**
 * The widget a child node contributes to its parent: its backing widget, unless
 * it is a top-level surface (per the `TOP_LEVEL_TYPES` table — windows and
 * dialogs never attach as widget children) or a non-widget GObject.
 */
export const childWidget = (instance: Node): Gtk.Widget | null => {
    if (!(instance instanceof Gtk.Widget)) return null;
    if (isTopLevelSurface(instance)) return null;
    return instance;
};

/** Whether `instance` is a top-level surface that skips widget attachment. */
export const isTopLevel = (instance: Node): boolean =>
    instance instanceof GObject.Object && isTopLevelSurface(instance);

/** The wrapper's primary tracked content child, skipping the tab-label slot. */
const trackedChild = (marker: Node): Node | null => {
    const { children } = stateOf(marker);
    return children.find((child) => !isWrapperKind(child, TAB_LABEL_KIND)) ?? children[0] ?? null;
};

/** The wrapper's tracked content child as a widget, or `null`. */
export const trackedWidget = (marker: Node): Gtk.Widget | null => {
    const child = trackedChild(marker);
    return child instanceof Gtk.Widget ? child : null;
};

/** The wrapper's tracked content child as a GObject, or `undefined`. */
export const trackedInstance = (marker: Node): GObject.Object | undefined => {
    const child = trackedChild(marker);
    return child instanceof GObject.Object ? child : undefined;
};

/** Every widget child of a wrapper marker, in order. */
export const wrapperChildWidgets = (marker: Node): Gtk.Widget[] => {
    const widgets: Gtk.Widget[] = [];
    for (const child of stateOf(marker).children) {
        if (child instanceof Gtk.Widget) widgets.push(child);
    }
    return widgets;
};

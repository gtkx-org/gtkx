/// <reference types="@gtkx/config/env" />

import { TOP_LEVEL_TYPES } from "virtual:gtkx-config";
import { TAB_LABEL_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { hasType } from "../../utils/gtype-predicates.js";
import { isWrapperKind, type Node, stateOf } from "../state.js";

export const isTopLevelSurface = (widget: GObject.Object): boolean =>
    TOP_LEVEL_TYPES.some((typeName) => hasType(widget, typeName));

export const childWidget = (instance: Node): Gtk.Widget | null => {
    if (!(instance instanceof Gtk.Widget)) return null;
    if (isTopLevelSurface(instance)) return null;
    return instance;
};

export const isTopLevel = (instance: Node): boolean =>
    instance instanceof GObject.Object && isTopLevelSurface(instance);

const trackedChild = (marker: Node): Node | null => {
    const { children } = stateOf(marker);
    return children.find((child) => !isWrapperKind(child, TAB_LABEL_KIND)) ?? children[0] ?? null;
};

export const trackedWidget = (marker: Node): Gtk.Widget | null => {
    const child = trackedChild(marker);
    return child instanceof Gtk.Widget ? child : null;
};

export const trackedInstance = (marker: Node): GObject.Object | undefined => {
    const child = trackedChild(marker);
    return child instanceof GObject.Object ? child : undefined;
};

export const wrapperChildWidgets = (marker: Node): Gtk.Widget[] => {
    const widgets: Gtk.Widget[] = [];
    for (const child of stateOf(marker).children) {
        if (child instanceof Gtk.Widget) widgets.push(child);
    }
    return widgets;
};

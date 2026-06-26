/// <reference types="@gtkx/config/env" />

import { TOP_LEVEL_TYPES } from "virtual:gtkx-config";
import { TAB_LABEL_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { hasType } from "../utils/gtype-predicates.js";
import { isRelationshipKind, type Node, stateOf } from "./state.js";

const isToplevel = (widget: GObject.Object): boolean => TOP_LEVEL_TYPES.some((typeName) => hasType(widget, typeName));

export const childWidget = (instance: Node): Gtk.Widget | null => {
    if (!(instance instanceof Gtk.Widget)) return null;
    if (isToplevel(instance)) return null;
    return instance;
};

export const isTopLevel = (instance: Node): boolean => instance instanceof GObject.Object && isToplevel(instance);

const trackedChild = (wrapper: Node): Node | null => {
    const { children } = stateOf(wrapper);
    return children.find((child) => !isRelationshipKind(child, TAB_LABEL_KIND)) ?? children[0] ?? null;
};

export const trackedWidget = (wrapper: Node): Gtk.Widget | null => {
    const child = trackedChild(wrapper);
    return child instanceof Gtk.Widget ? child : null;
};

export const trackedInstance = (wrapper: Node): GObject.Object | undefined => {
    const child = trackedChild(wrapper);
    return child instanceof GObject.Object ? child : undefined;
};

export const relationshipChildren = <T extends GObject.Object>(wrapper: Node, ctor: AnyClass<T>): T[] =>
    stateOf(wrapper).children.filter((child): child is T => child instanceof ctor);

export const relationshipChildWidgets = (wrapper: Node): Gtk.Widget[] => relationshipChildren(wrapper, Gtk.Widget);

export const relationshipChildInstances = (wrapper: Node): GObject.Object[] =>
    relationshipChildren(wrapper, GObject.Object);

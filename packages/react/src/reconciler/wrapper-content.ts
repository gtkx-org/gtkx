/// <reference types="@gtkx/config/env" />

import { TOPLEVEL_TYPES } from "virtual:gtkx-config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { hasType } from "../utils/gtype-predicates.js";
import { type Node, stateOf } from "./state.js";
import { isWrapperNode } from "./wrapper-node.js";

const isToplevelType = (widget: GObject.Object): boolean =>
    TOPLEVEL_TYPES.some((typeName) => hasType(widget, typeName));

export const childWidget = (instance: Node): Gtk.Widget | null => {
    if (!(instance instanceof Gtk.Widget)) return null;
    if (isToplevelType(instance)) return null;
    return instance;
};

export const isToplevel = (instance: Node): boolean => instance instanceof GObject.Object && isToplevelType(instance);

const trackedChild = (node: Node): Node | null => {
    const { children } = stateOf(node);
    return children.find((child) => !isWrapperNode(child)) ?? children[0] ?? null;
};

export const trackedWidget = (node: Node): Gtk.Widget | null => {
    const child = trackedChild(node);
    return child instanceof Gtk.Widget ? child : null;
};

export const trackedInstance = (node: Node): GObject.Object | undefined => {
    const child = trackedChild(node);
    return child instanceof GObject.Object ? child : undefined;
};

const wrapperChildren = <T extends GObject.Object>(node: Node, ctor: AnyClass<T>): T[] =>
    stateOf(node).children.filter((child): child is T => child instanceof ctor);

export const wrapperChildWidgets = (node: Node): Gtk.Widget[] => wrapperChildren(node, Gtk.Widget);

export const wrapperChildInstances = (node: Node): GObject.Object[] => wrapperChildren(node, GObject.Object);

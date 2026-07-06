import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { type Node, stateOf } from "./state.js";
import { isWrapperNode } from "./wrapper-node.js";

export const childWidget = (instance: Node): Gtk.Widget | null => (instance instanceof Gtk.Widget ? instance : null);

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

export const wrapperChildInstances = (node: Node): GObject.Object[] => wrapperChildren(node, GObject.Object);

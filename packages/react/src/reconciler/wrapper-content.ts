import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type Node, stateOf } from "./state.js";
import { isWrapperNode } from "./wrapper-node.js";

const trackedChildOf = (node: Node): Node | null => {
    const { children } = stateOf(node);
    return children.find((child) => !isWrapperNode(child)) ?? children[0] ?? null;
};

export const trackedWidgetOf = (node: Node): Gtk.Widget | null => {
    const child = trackedChildOf(node);
    return child instanceof Gtk.Widget ? child : null;
};

export const trackedInstanceOf = (node: Node): GObject.Object | undefined => {
    const child = trackedChildOf(node);
    return child instanceof GObject.Object ? child : undefined;
};

export const collectWrapperChildInstances = (node: Node): GObject.Object[] =>
    stateOf(node).children.filter((child): child is GObject.Object => child instanceof GObject.Object);

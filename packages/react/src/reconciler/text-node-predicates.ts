import * as Gtk from "@gtkx/gi/gtk";
import { hasWrapperKind, type Node, stateOf } from "./state.js";
import { TEXT_KIND } from "./wrapper-kinds.js";

export const isTextNode = (node: Node): boolean => hasWrapperKind(node, TEXT_KIND);

const isBufferTextNode = (node: Node): boolean => {
    if (!isTextNode(node)) return false;
    const parent = stateOf(node).parent;
    return parent instanceof Gtk.TextBuffer || parent instanceof Gtk.TextTag;
};

export const isBufferContentNode = (node: Node): boolean =>
    isBufferTextNode(node) ||
    node instanceof Gtk.TextTag ||
    node instanceof Gtk.TextChildAnchor ||
    node instanceof Gtk.TextMark;

export const isLabelTextNode = (node: Node): boolean => isTextNode(node) && stateOf(node).parent instanceof Gtk.Label;

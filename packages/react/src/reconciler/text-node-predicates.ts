import * as Gtk from "@gtkx/gi/gtk";
import { hasWrapperKind, type Node } from "./state.js";
import { BUFFER_TEXT_KIND, LABEL_TEXT_KIND } from "./wrapper-kinds.js";

const isBufferTextNode = (node: Node): boolean => hasWrapperKind(node, BUFFER_TEXT_KIND);

export const isBufferContentNode = (node: Node): boolean =>
    isBufferTextNode(node) ||
    node instanceof Gtk.TextTag ||
    node instanceof Gtk.TextChildAnchor ||
    node instanceof Gtk.TextMark;

export const isLabelTextNode = (node: Node): boolean => hasWrapperKind(node, LABEL_TEXT_KIND);

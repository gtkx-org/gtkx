import { hasWrapperKind, type Node } from "./state.js";
import { BUFFER_TEXT_KIND, LABEL_TEXT_KIND, TEXT_ANCHOR_KIND, TEXT_PAINTABLE_KIND } from "./wrapper-protocol.js";

export const isBufferTextNode = (node: Node): boolean => hasWrapperKind(node, BUFFER_TEXT_KIND);

export const isPaintableNode = (node: Node): boolean => hasWrapperKind(node, TEXT_PAINTABLE_KIND);

export const isAnchorNode = (node: Node): boolean => hasWrapperKind(node, TEXT_ANCHOR_KIND);

export const isBufferContentNode = (node: Node): boolean =>
    isBufferTextNode(node) || isPaintableNode(node) || isAnchorNode(node);

export const isLabelTextNode = (node: Node): boolean => hasWrapperKind(node, LABEL_TEXT_KIND);

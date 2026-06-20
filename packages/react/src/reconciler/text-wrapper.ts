import { isWrapperKind, type Node } from "./state.js";
import { ANCHOR_KIND, BUFFER_TEXT_KIND, LABEL_TEXT_KIND, PAINTABLE_KIND } from "./text-kinds.js";

export const isBufferTextWrapper = (node: Node): boolean => isWrapperKind(node, BUFFER_TEXT_KIND);

export const isPaintableWrapper = (node: Node): boolean => isWrapperKind(node, PAINTABLE_KIND);

export const isAnchorWrapper = (node: Node): boolean => isWrapperKind(node, ANCHOR_KIND);

export const isBufferContentWrapper = (node: Node): boolean =>
    isBufferTextWrapper(node) || isPaintableWrapper(node) || isAnchorWrapper(node);

export const isLabelTextWrapper = (node: Node): boolean => isWrapperKind(node, LABEL_TEXT_KIND);

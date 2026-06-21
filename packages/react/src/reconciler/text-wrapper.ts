import { BUFFER_TEXT_KIND, LABEL_TEXT_KIND, TEXT_ANCHOR_KIND, TEXT_PAINTABLE_KIND } from "@gtkx/config";
import { isWrapperKind, type Node } from "./state.js";

export const isBufferTextWrapper = (node: Node): boolean => isWrapperKind(node, BUFFER_TEXT_KIND);

export const isPaintableWrapper = (node: Node): boolean => isWrapperKind(node, TEXT_PAINTABLE_KIND);

export const isAnchorWrapper = (node: Node): boolean => isWrapperKind(node, TEXT_ANCHOR_KIND);

export const isBufferContentWrapper = (node: Node): boolean =>
    isBufferTextWrapper(node) || isPaintableWrapper(node) || isAnchorWrapper(node);

export const isLabelTextWrapper = (node: Node): boolean => isWrapperKind(node, LABEL_TEXT_KIND);

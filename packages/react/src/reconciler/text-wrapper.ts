import { isWrapperKind, type Node } from "./state.js";
import { ANCHOR_KIND, BUFFER_TEXT_KIND, LABEL_TEXT_KIND, PAINTABLE_KIND } from "./text-kinds.js";

/**
 * Whether `node` is a raw-text wrapper produced for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isBufferTextWrapper = (node: Node): boolean => isWrapperKind(node, BUFFER_TEXT_KIND);

/**
 * Whether `node` is an inline-paintable wrapper for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isPaintableWrapper = (node: Node): boolean => isWrapperKind(node, PAINTABLE_KIND);

/**
 * Whether `node` is an anchored-widget wrapper for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isAnchorWrapper = (node: Node): boolean => isWrapperKind(node, ANCHOR_KIND);

/**
 * Whether `node` is any wrapper that the text-buffer controller linearizes:
 * a raw text run, an inline paintable, or an anchored widget.
 *
 * @param node - The candidate child node.
 */
export const isBufferContentWrapper = (node: Node): boolean =>
    isBufferTextWrapper(node) || isPaintableWrapper(node) || isAnchorWrapper(node);

/**
 * Whether `node` is a raw-text wrapper produced for a label's text content.
 *
 * @param node - The candidate child node.
 */
export const isLabelTextWrapper = (node: Node): boolean => isWrapperKind(node, LABEL_TEXT_KIND);

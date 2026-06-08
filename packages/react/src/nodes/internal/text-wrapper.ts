import type * as Gdk from "@gtkx/gi/gdk";
import type { Node } from "../../node.js";
import { ANCHOR_KIND, BUFFER_TEXT_KIND, PAINTABLE_KIND } from "./text-buffer-kinds.js";

/** A node carrying a raw text run for a text buffer. */
export type BufferTextNode = Node<undefined, { text: string }>;

/** A node carrying an inline paintable for a text buffer. */
export type PaintableNode = Node<undefined, { paintable: Gdk.Paintable }>;

/** A node carrying an anchored-widget placement for a text buffer. */
export type AnchorNode = Node<undefined, { replacementChar?: string }>;

const isWrapperOfKind = (node: Node, kind: string): boolean =>
    node.backingInstance === undefined && node.typeName === kind;

/**
 * Whether `node` is a raw-text wrapper produced for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isBufferTextWrapper = (node: Node): node is BufferTextNode => isWrapperOfKind(node, BUFFER_TEXT_KIND);

/**
 * Whether `node` is an inline-paintable wrapper for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isPaintableWrapper = (node: Node): node is PaintableNode => isWrapperOfKind(node, PAINTABLE_KIND);

/**
 * Whether `node` is an anchored-widget wrapper for buffered text content.
 *
 * @param node - The candidate child node.
 */
export const isAnchorWrapper = (node: Node): node is AnchorNode => isWrapperOfKind(node, ANCHOR_KIND);

/**
 * Whether `node` is any wrapper that the text-buffer controller linearizes:
 * a raw text run, an inline paintable, or an anchored widget.
 *
 * @param node - The candidate child node.
 */
export const isBufferContentWrapper = (node: Node): boolean =>
    isBufferTextWrapper(node) || isPaintableWrapper(node) || isAnchorWrapper(node);

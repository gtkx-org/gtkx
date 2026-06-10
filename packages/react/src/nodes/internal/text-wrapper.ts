import type { Instance } from "../../instance.js";
import { ANCHOR_KIND, BUFFER_TEXT_KIND, LABEL_TEXT_KIND, PAINTABLE_KIND } from "./text-kinds.js";

const isWrapperOfKind = (instance: Instance, kind: string): boolean =>
    instance.backingInstance === undefined && instance.kind === kind;

/**
 * Whether `instance` is a raw-text wrapper produced for buffered text content.
 *
 * @param instance - The candidate child instance.
 */
export const isBufferTextWrapper = (instance: Instance): boolean => isWrapperOfKind(instance, BUFFER_TEXT_KIND);

/**
 * Whether `instance` is an inline-paintable wrapper for buffered text content.
 *
 * @param instance - The candidate child instance.
 */
export const isPaintableWrapper = (instance: Instance): boolean => isWrapperOfKind(instance, PAINTABLE_KIND);

/**
 * Whether `instance` is an anchored-widget wrapper for buffered text content.
 *
 * @param instance - The candidate child instance.
 */
export const isAnchorWrapper = (instance: Instance): boolean => isWrapperOfKind(instance, ANCHOR_KIND);

/**
 * Whether `instance` is any wrapper that the text-buffer controller linearizes:
 * a raw text run, an inline paintable, or an anchored widget.
 *
 * @param instance - The candidate child instance.
 */
export const isBufferContentWrapper = (instance: Instance): boolean =>
    isBufferTextWrapper(instance) || isPaintableWrapper(instance) || isAnchorWrapper(instance);

/**
 * Whether `instance` is a raw-text wrapper produced for a label's text content.
 *
 * @param instance - The candidate child instance.
 */
export const isLabelTextWrapper = (instance: Instance): boolean => isWrapperOfKind(instance, LABEL_TEXT_KIND);

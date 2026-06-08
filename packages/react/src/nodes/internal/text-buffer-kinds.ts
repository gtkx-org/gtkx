/** Wrapper kind for a raw text run inside a text buffer. */
export const BUFFER_TEXT_KIND = "text";

/** Wrapper kind for an inline paintable embedded in a text buffer. */
export const PAINTABLE_KIND = "text-paintable";

/** Wrapper kind for a widget anchored into a text buffer. */
export const ANCHOR_KIND = "text-anchor";

const BUFFER_CONTENT_KINDS: ReadonlySet<string> = new Set([BUFFER_TEXT_KIND, PAINTABLE_KIND, ANCHOR_KIND]);

/**
 * Whether a wrapper `kind` carries buffered text content. Wrappers of these
 * kinds are inert in the strategy interpreter — their children and props are
 * read by the text-buffer controller, never attached to a GTK parent.
 *
 * @param kind - The wrapper kind name.
 */
export const isBufferContentKind = (kind: string): boolean => BUFFER_CONTENT_KINDS.has(kind);

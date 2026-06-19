/**
 * Brand key marking an object as a {@link WrapperElement}. Resolved through the
 * global symbol registry so the brand is recognized even when `@gtkx/react` is
 * instantiated more than once in a single process.
 */
export const WRAPPER_ELEMENT: unique symbol = Symbol.for("gtkx.wrapperElement");

/**
 * Opaque reconciler node for a metadata wrapper or text run — a node with no
 * backing GObject. Its kind and attachment metadata live in the reconciler's
 * state map, keyed by this token.
 */
export type WrapperElement = { readonly [WRAPPER_ELEMENT]: true };

/** Creates a fresh {@link WrapperElement} node token. */
export const createWrapperElement = (): WrapperElement => ({ [WRAPPER_ELEMENT]: true });

/**
 * Type guard recognizing a {@link WrapperElement} node token.
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a wrapper node token.
 */
export const isWrapperElement = (value: unknown): value is WrapperElement =>
    typeof value === "object" && value !== null && WRAPPER_ELEMENT in value;

/**
 * Brand key marking an object as a {@link RootElement}. Resolved through the
 * global symbol registry so the brand is recognized even when `@gtkx/react` is
 * instantiated more than once in a single process.
 */
export const ROOT_ELEMENT: unique symbol = Symbol.for("gtkx.rootElement");

/**
 * Opaque, per-root container token created by {@link createRootElement}. It
 * carries no GLib type, so the reconciler routes it to an inert root node whose
 * mutations are no-ops. A distinct token per render keeps each root's node and
 * signal bookkeeping isolated and lets them be reclaimed once the root is torn
 * down.
 */
export type RootElement = { readonly [ROOT_ELEMENT]: true };

/**
 * Creates a fresh {@link RootElement} container token.
 *
 * Pass the result as the `container` option to `@gtkx/testing`'s `render` to
 * mount a top-level element — a `GtkApplication`/`AdwApplication` or a window —
 * directly at the reconciler root, with no host window. The production `render`
 * uses one internally for the same purpose. Call it once per root: two
 * simultaneously mounted roots must not share a token.
 *
 * @returns A new per-root container token.
 *
 * @example
 * ```tsx
 * import { render } from "@gtkx/testing";
 * import { createRootElement } from "@gtkx/react";
 *
 * await render(<MyApp />, { container: createRootElement() });
 * ```
 */
export const createRootElement = (): RootElement => ({ [ROOT_ELEMENT]: true });

/**
 * Type guard recognizing a {@link RootElement} token produced by
 * {@link createRootElement}.
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a root element token.
 */
export const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && ROOT_ELEMENT in value;

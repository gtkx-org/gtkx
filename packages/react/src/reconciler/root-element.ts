const ROOT_ELEMENT: unique symbol = Symbol.for("gtkx.rootElement");

/**
 * Branded container marker used as the synthetic reconciler root when no GTK widget container
 * is supplied.
 */
export type RootElement = { [ROOT_ELEMENT]: true };

/**
 * Creates a fresh {@link RootElement} container marker for use as a reconciler root.
 *
 * @returns A new root-element marker.
 */
export const createRootElement = (): RootElement => ({ [ROOT_ELEMENT]: true });

/**
 * Type guard for {@link RootElement} markers.
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a root-element marker.
 */
export const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && ROOT_ELEMENT in value;

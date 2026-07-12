const ROOT_ELEMENT: unique symbol = Symbol.for("gtkx.rootElement");

/**
 * The type of the singleton marker used as the top-level render container.
 */
export type RootElement = { [ROOT_ELEMENT]: true };

/**
 * The shared root element used as the default container for `createRoot`.
 */
export const rootElement: RootElement = { [ROOT_ELEMENT]: true };

export const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && ROOT_ELEMENT in value;

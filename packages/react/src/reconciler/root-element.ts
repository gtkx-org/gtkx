const ROOT_ELEMENT_BRAND: unique symbol = Symbol.for("gtkx:root-element");

/** The type of the shared {@link rootElement} marker used as a default top-level container. */
export type RootElement = { [ROOT_ELEMENT_BRAND]: true };

/** A shared marker value used as the default top-level container for rendering and portals. */
export const rootElement: RootElement = { [ROOT_ELEMENT_BRAND]: true };

/** Reports whether an arbitrary value is a {@link rootElement} marker. */
export const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && Object.hasOwn(value, ROOT_ELEMENT_BRAND);

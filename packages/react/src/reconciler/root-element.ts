/** The type of the shared {@link rootElement} marker used as a default top-level container. */
type RootElement = { [ROOT_ELEMENT_BRAND]: true };

const ROOT_ELEMENT_BRAND: unique symbol = Symbol.for("gtkx:root-element");
/** A shared marker value used as the default top-level container for rendering and portals. */
const rootElement: RootElement = { [ROOT_ELEMENT_BRAND]: true };

const isRootElement = (value: unknown): value is RootElement =>
    typeof value === "object" && value !== null && Object.hasOwn(value, ROOT_ELEMENT_BRAND);

export { rootElement, isRootElement, type RootElement };

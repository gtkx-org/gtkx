/** GLib type names of elements whose GObject is created by their parent container (pages, layout children). */
export const LAZY_ELEMENTS: Set<string> = new Set();

/** Registers element types as lazy: their node defers object creation to the parent's adoption. */
export const registerLazyElements = (names: string[]): void => {
    for (const name of names) LAZY_ELEMENTS.add(name);
};

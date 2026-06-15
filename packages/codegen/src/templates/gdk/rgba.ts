/**
 * Hand-written `Gdk.RGBA` factory shorthand.
 *
 * `RGBA` gains a `static create` shorthand that has no GIR backing. This module
 * implements that `create` and re-exports the GIR-generated `RGBA` augmented
 * with it via `Object.assign`.
 */

import { RGBA as GeneratedRGBA } from "../gdk.js";

/**
 * Constructs an {@link RGBA} from a textual color specification.
 *
 * @param value - A color specification parsed by `RGBA.parse`.
 * @returns The parsed `RGBA` instance.
 */
const create = (value: string): GeneratedRGBA => {
    const rgba = new GeneratedRGBA();
    rgba.parse(value);
    return rgba;
};

/**
 * The `Gdk.RGBA` boxed type, extended with the `create` factory shorthand.
 */
export const RGBA: typeof GeneratedRGBA & { create: typeof create } = Object.assign(GeneratedRGBA, { create });

/**
 * An instance of the `Gdk.RGBA` boxed type.
 */
// biome-ignore lint/style/useNamingConvention: mirrors the GIR `Gdk.RGBA` boxed type name
export type RGBA = GeneratedRGBA;

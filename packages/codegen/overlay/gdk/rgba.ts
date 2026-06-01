/**
 * Hand-written `Gdk.RGBA` factory shorthand.
 *
 * The contract `.d.ts` declares a `static create` on `RGBA` that ts-for-gir
 * injects from its node-gtk override tables; it has no GIR backing. This module
 * re-exports the generated `RGBA` with that static implemented, keeping the FFI
 * runtime in agreement with the contract.
 */

import { RGBA as GeneratedRGBA } from "@gtkx/gi/gdk/gdk.js";

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
export type RGBA = GeneratedRGBA;

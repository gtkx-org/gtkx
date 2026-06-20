import { RGBA as GeneratedRGBA } from "../gdk.js";

const create = (value: string): GeneratedRGBA => {
    const rgba = new GeneratedRGBA();
    rgba.parse(value);
    return rgba;
};

export const RGBA: typeof GeneratedRGBA & { create: typeof create } = Object.assign(GeneratedRGBA, { create });

// biome-ignore lint/style/useNamingConvention: mirrors the GIR `Gdk.RGBA` boxed type name
export type RGBA = GeneratedRGBA;

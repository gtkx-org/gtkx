import { RGBA as GeneratedRGBA } from "../gdk.js";

const create = (value: string): GeneratedRGBA => {
    const rgba = new GeneratedRGBA();
    rgba.parse(value);
    return rgba;
};

export const RGBA: typeof GeneratedRGBA & { create: typeof create } = Object.assign(GeneratedRGBA, { create });

export type RGBA = GeneratedRGBA;

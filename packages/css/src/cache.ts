import { Stylesheet } from "./stylesheet.js";

let stylesheet: Stylesheet | null = null;

export const getStylesheet = (): Stylesheet => (stylesheet ??= new Stylesheet());

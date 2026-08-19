import "./legacy/font-face.js";
import "./legacy/scaled-font.js";

/** @public */
export { Device, FontFace, ScaledFont } from "./base.js";
/** @public */
export { Context } from "./context.js";
/** @public */
export * from "./enums.js";
/** @public */
export { FtFontFace, FtSynthesize, ToyFontFace } from "./legacy/font-face.js";
/** @public */
export { FontOptions } from "./legacy/font-options.js";
/** @public */
export { Matrix } from "./matrix.js";
/** @public */
export { Path } from "./path.js";
/** @public */
export { LinearPattern, MeshPattern, Pattern, RadialPattern } from "./pattern.js";
/** @public */
export { Region } from "./region.js";
/** @public */
export * from "./structs.js";
/** @public */
export { ImageSurface, RecordingSurface, Surface } from "./surface.js";
/** @public */
export type * from "./types.js";
/** @public */
export { statusToString, version, versionString } from "./version.js";

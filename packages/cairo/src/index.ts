import "./legacy/font-face.js";
import "./legacy/scaled-font.js";
import "./legacy/surface.js";

/** @public */
export { Device, FontFace, Pattern, ScaledFont, Surface } from "./base.js";
/** @public */
export { Context } from "./context.js";
/** @public */
export * from "./enums.js";
/** @public */
export { FtFontFace, FtSynthesize, ToyFontFace } from "./legacy/font-face.js";
/** @public */
export { FontOptions } from "./legacy/font-options.js";
/** @public */
export { ImageSurface } from "./legacy/image-surface.js";
/** @public */
export { LinearPattern, MeshPattern, RadialPattern } from "./legacy/pattern.js";
/** @public */
export { RecordingSurface } from "./legacy/recording-surface.js";
/** @public */
export { Matrix } from "./matrix.js";
/** @public */
export { Path } from "./path.js";
/** @public */
export { Region } from "./region.js";
/** @public */
export * from "./structs.js";
/** @public */
export type * from "./types.js";
/** @public */
export { statusToString, version, versionString } from "./version.js";

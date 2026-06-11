export * from "./cairo.js";

import "./overrides/font-face.js";
import "./overrides/scaled-font.js";
import "./overrides/surface.js";

export type { CairoGlyph, CairoTextCluster, PathData } from "@gtkx/ffi/cairo";
export { cairoVersion, cairoVersionString } from "@gtkx/ffi/cairo";
export { Context, type FontExtents, statusToString, type TextExtents } from "./overrides/context.js";
export { FtFontFace, ToyFontFace } from "./overrides/font-face.js";
export { FontOptions } from "./overrides/font-options.js";
export { ImageSurface } from "./overrides/image-surface.js";
export { Matrix } from "./overrides/matrix.js";
export { LinearPattern, MeshPattern, RadialPattern } from "./overrides/pattern.js";
export { RecordingSurface } from "./overrides/recording-surface.js";
export { Region } from "./overrides/region.js";

import { alloc, call, createRef, type NativeHandle, read } from "@gtkx/native";
import { Context } from "../generated/cairo/context.js";
import type {
    Antialias,
    FillRule,
    FontSlant,
    FontWeight,
    LineCap,
    LineJoin,
    Operator,
} from "../generated/cairo/enums.js";
import { FontOptions } from "../generated/cairo/font-options.js";
import { Pattern } from "../generated/cairo/pattern.js";
import { Surface } from "../generated/cairo/surface.js";
import { getNativeObject } from "../native/object.js";

export { Context, Pattern, FontOptions, Surface };

const LIB = "libcairo.so.2";
const LIB_GOBJECT = "libcairo-gobject.so.2";

const FONT_OPTIONS_T = {
    type: "boxed",
    innerType: "CairoFontOptions",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_font_options_get_type",
    ownership: "borrowed",
} as const;

const CAIRO_T = {
    type: "boxed",
    innerType: "CairoContext",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_context_get_type",
    ownership: "borrowed",
} as const;

const PATTERN_T = {
    type: "boxed",
    innerType: "CairoPattern",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_pattern_get_type",
    ownership: "full",
} as const;

const PATTERN_T_NONE = {
    type: "boxed",
    innerType: "CairoPattern",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_pattern_get_type",
    ownership: "borrowed",
} as const;

const SURFACE_T = {
    type: "boxed",
    innerType: "CairoSurface",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_surface_get_type",
    ownership: "full",
} as const;

const SURFACE_T_NONE = {
    type: "boxed",
    innerType: "CairoSurface",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_surface_get_type",
    ownership: "borrowed",
} as const;

const DOUBLE_TYPE = { type: "float", size: 64 } as const;

declare module "../generated/cairo/context.js" {
    interface Context {
        /**
         * Begins a new sub-path by moving the current point to the specified coordinates.
         * @param x - The X coordinate of the new position
         * @param y - The Y coordinate of the new position
         */
        moveTo(x: number, y: number): this;
        /**
         * Adds a line to the path from the current point to the specified coordinates.
         * @param x - The X coordinate of the end of the line
         * @param y - The Y coordinate of the end of the line
         */
        lineTo(x: number, y: number): this;
        /**
         * Relative move: begins a new sub-path offset from the current point.
         * @param dx - The X offset from the current point
         * @param dy - The Y offset from the current point
         */
        relMoveTo(dx: number, dy: number): this;
        /**
         * Relative line: adds a line from the current point by the given offset.
         * @param dx - The X offset from the current point
         * @param dy - The Y offset from the current point
         */
        relLineTo(dx: number, dy: number): this;
        /**
         * Relative curve: adds a cubic Bézier spline with control points relative to current point.
         * @param dx1 - X offset of the first control point
         * @param dy1 - Y offset of the first control point
         * @param dx2 - X offset of the second control point
         * @param dy2 - Y offset of the second control point
         * @param dx3 - X offset of the end point
         * @param dy3 - Y offset of the end point
         */
        relCurveTo(dx1: number, dy1: number, dx2: number, dy2: number, dx3: number, dy3: number): this;
        /**
         * Adds a cubic Bézier spline to the path from the current point to (x3, y3),
         * using (x1, y1) and (x2, y2) as control points.
         * @param x1 - X coordinate of the first control point
         * @param y1 - Y coordinate of the first control point
         * @param x2 - X coordinate of the second control point
         * @param y2 - Y coordinate of the second control point
         * @param x3 - X coordinate of the end point
         * @param y3 - Y coordinate of the end point
         */
        curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
        /**
         * Adds a circular arc to the current path, going in the positive angle direction.
         * @param xc - X coordinate of the center of the arc
         * @param yc - Y coordinate of the center of the arc
         * @param radius - The radius of the arc
         * @param angle1 - The start angle in radians
         * @param angle2 - The end angle in radians
         */
        arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): this;
        /**
         * Adds a circular arc to the current path, going in the negative angle direction.
         * @param xc - X coordinate of the center of the arc
         * @param yc - Y coordinate of the center of the arc
         * @param radius - The radius of the arc
         * @param angle1 - The start angle in radians
         * @param angle2 - The end angle in radians
         */
        arcNegative(xc: number, yc: number, radius: number, angle1: number, angle2: number): this;
        /**
         * Adds a closed sub-path rectangle to the current path.
         * @param x - The X coordinate of the top-left corner
         * @param y - The Y coordinate of the top-left corner
         * @param width - The width of the rectangle
         * @param height - The height of the rectangle
         */
        rectangle(x: number, y: number, width: number, height: number): this;
        /**
         * Adds a line segment to the path from the current point to the beginning
         * of the current sub-path and closes the sub-path.
         */
        closePath(): this;
        /**
         * Clears the current path, leaving no defined current point.
         */
        newPath(): this;
        /**
         * Begins a new sub-path without moving the current point.
         */
        newSubPath(): this;

        /**
         * Strokes the current path using the current line width and stroke settings,
         * then clears the path.
         */
        stroke(): this;
        /**
         * Strokes the current path but preserves it for further operations.
         */
        strokePreserve(): this;
        /**
         * Fills the current path using the current fill rule, then clears the path.
         */
        fill(): this;
        /**
         * Fills the current path but preserves it for further operations.
         */
        fillPreserve(): this;
        /**
         * Paints the current source everywhere within the current clip region.
         */
        paint(): this;
        /**
         * Paints the current source with the given alpha transparency.
         * @param alpha - The alpha value (0.0 to 1.0)
         */
        paintWithAlpha(alpha: number): this;
        /**
         * Establishes a new clip region by intersecting the current clip region
         * with the current path, then clears the path.
         */
        clip(): this;
        /**
         * Establishes a new clip region but preserves the current path.
         */
        clipPreserve(): this;
        /**
         * Resets the current clip region to its original, unrestricted state.
         */
        resetClip(): this;

        /**
         * Sets the source color to an opaque RGB color.
         * @param red - Red component (0.0 to 1.0)
         * @param green - Green component (0.0 to 1.0)
         * @param blue - Blue component (0.0 to 1.0)
         */
        setSourceRgb(red: number, green: number, blue: number): this;
        /**
         * Sets the source color to an RGBA color with alpha transparency.
         * @param red - Red component (0.0 to 1.0)
         * @param green - Green component (0.0 to 1.0)
         * @param blue - Blue component (0.0 to 1.0)
         * @param alpha - Alpha component (0.0 to 1.0)
         */
        setSourceRgba(red: number, green: number, blue: number, alpha: number): this;
        /**
         * Sets the source pattern for drawing operations.
         * @param pattern - The pattern to use as source
         */
        setSource(pattern: Pattern): this;

        /**
         * Sets the current line width for stroke operations.
         * @param width - The line width in user-space units
         */
        setLineWidth(width: number): this;
        /**
         * Sets the line cap style for stroke operations.
         * @param lineCap - The line cap style
         */
        setLineCap(lineCap: LineCap): this;
        /**
         * Sets the line join style for stroke operations.
         * @param lineJoin - The line join style
         */
        setLineJoin(lineJoin: LineJoin): this;
        /**
         * Sets the dash pattern for stroke operations.
         * @param dashes - Array of dash lengths (alternating on/off)
         * @param offset - Offset into the dash pattern to start
         */
        setDash(dashes: number[], offset: number): this;

        /**
         * Sets the fill rule for determining which regions are inside a path.
         * @param fillRule - The fill rule to use
         */
        setFillRule(fillRule: FillRule): this;
        /**
         * Gets the current fill rule.
         * @returns The current fill rule
         */
        getFillRule(): FillRule;

        /**
         * Saves the current graphics state onto a stack.
         */
        save(): this;
        /**
         * Restores the graphics state from the stack.
         */
        restore(): this;
        /**
         * Translates the user-space origin by the specified amounts.
         * @param tx - Translation in the X direction
         * @param ty - Translation in the Y direction
         */
        translate(tx: number, ty: number): this;
        /**
         * Scales the user-space coordinate system.
         * @param sx - Scale factor in the X direction
         * @param sy - Scale factor in the Y direction
         */
        scale(sx: number, sy: number): this;
        /**
         * Rotates the user-space coordinate system.
         * @param angle - The rotation angle in radians
         */
        rotate(angle: number): this;

        /**
         * Sets the compositing operator for drawing operations.
         * @param op - The compositing operator
         */
        setOperator(op: Operator): this;

        /**
         * Selects a font face by family name, slant, and weight.
         * @param family - The font family name
         * @param slant - The font slant (normal, italic, oblique)
         * @param weight - The font weight (normal, bold)
         */
        selectFontFace(family: string, slant: FontSlant, weight: FontWeight): this;
        /**
         * Sets the current font size in user-space units.
         * @param size - The font size
         */
        setFontSize(size: number): this;
        /**
         * Draws text glyphs at the current point.
         * @param text - The text string to display
         */
        showText(text: string): this;
        /**
         * Adds closed paths for text glyphs to the current path.
         * @param text - The text string to convert to paths
         */
        textPath(text: string): this;
        /**
         * Gets the extents (dimensions and positioning) for a text string.
         * @param text - The text string to measure
         * @returns The text extents including width, height, and bearing
         */
        textExtents(text: string): TextExtents;

        /**
         * Sets the font options for text rendering.
         * @param options - The font options to apply
         */
        setFontOptions(options: FontOptions): this;
        /**
         * Gets the current font options.
         * @returns The current font options
         */
        getFontOptions(): FontOptions;
        /**
         * Sets the antialiasing mode for rendering.
         * @param antialias - The antialiasing mode
         */
        setAntialias(antialias: Antialias): this;
        /**
         * Gets the current antialiasing mode.
         * @returns The current antialiasing mode
         */
        getAntialias(): Antialias;
        /**
         * Emits the current page for backends that support multiple pages (PDF, PostScript).
         * After this call, the current page is cleared.
         */
        showPage(): this;
        /**
         * Gets the target surface for the cairo context.
         * @returns The target surface
         */
        getTarget(): Surface;
        /**
         * Sets a surface as the source pattern for drawing operations.
         * @param surface - The surface to use as source
         * @param x - X coordinate of the surface origin
         * @param y - Y coordinate of the surface origin
         */
        setSourceSurface(surface: Surface, x: number, y: number): this;
        /**
         * Gets the current point of the current path.
         * @returns An object with x and y coordinates, or null if there is no current point
         */
        getCurrentPoint(): { x: number; y: number } | null;
    }
}

declare module "../generated/cairo/surface.js" {
    interface Surface {
        /**
         * Creates a Cairo drawing context for this surface.
         * @returns A new Context for drawing on this surface
         */
        createContext(): Context;
        /**
         * Finishes the surface and flushes any pending output.
         * After calling this, the surface should not be used.
         */
        finish(): void;
        /**
         * Creates a new surface similar to this one.
         * @param content - The content type ("COLOR", "ALPHA", or "COLOR_ALPHA")
         * @param width - Width of the new surface in device-space units
         * @param height - Height of the new surface in device-space units
         * @returns A new similar surface
         */
        createSimilar(content: "COLOR" | "ALPHA" | "COLOR_ALPHA", width: number, height: number): Surface;
    }
}

declare module "../generated/cairo/font-options.js" {
    interface FontOptions {
        /**
         * Sets the hint style for font rendering.
         * @param hintStyle - The hint style value
         */
        setHintStyle(hintStyle: number): this;
        /**
         * Sets the antialiasing mode for font rendering.
         * @param antialias - The antialiasing mode
         */
        setAntialias(antialias: Antialias): this;
        /**
         * Sets the metrics hinting mode.
         * @param hintMetrics - The hint metrics value
         */
        setHintMetrics(hintMetrics: number): this;
        /**
         * Sets the subpixel order for LCD font rendering.
         * @param subpixelOrder - The subpixel order value
         */
        setSubpixelOrder(subpixelOrder: number): this;
    }

    namespace FontOptions {
        /**
         * Creates a new font options object with default values.
         * @returns A new FontOptions instance
         */
        function create(): FontOptions;
    }
}

declare module "../generated/cairo/pattern.js" {
    interface Pattern {
        /**
         * Adds an opaque RGB color stop to a gradient pattern.
         * @param offset - Position along the gradient (0.0 to 1.0)
         * @param red - Red component (0.0 to 1.0)
         * @param green - Green component (0.0 to 1.0)
         * @param blue - Blue component (0.0 to 1.0)
         */
        addColorStopRgb(offset: number, red: number, green: number, blue: number): this;
        /**
         * Adds an RGBA color stop with alpha transparency to a gradient pattern.
         * @param offset - Position along the gradient (0.0 to 1.0)
         * @param red - Red component (0.0 to 1.0)
         * @param green - Green component (0.0 to 1.0)
         * @param blue - Blue component (0.0 to 1.0)
         * @param alpha - Alpha component (0.0 to 1.0)
         */
        addColorStopRgba(offset: number, red: number, green: number, blue: number, alpha: number): this;
    }

    namespace Pattern {
        /**
         * Creates a new linear gradient pattern along a line between two points.
         * @param x0 - X coordinate of the start point
         * @param y0 - Y coordinate of the start point
         * @param x1 - X coordinate of the end point
         * @param y1 - Y coordinate of the end point
         * @returns A new linear gradient pattern
         */
        function createLinear(x0: number, y0: number, x1: number, y1: number): Pattern;
        /**
         * Creates a new radial gradient pattern between two circles.
         * @param cx0 - X coordinate of the start circle center
         * @param cy0 - Y coordinate of the start circle center
         * @param radius0 - Radius of the start circle
         * @param cx1 - X coordinate of the end circle center
         * @param cy1 - Y coordinate of the end circle center
         * @param radius1 - Radius of the end circle
         * @returns A new radial gradient pattern
         */
        function createRadial(
            cx0: number,
            cy0: number,
            radius0: number,
            cx1: number,
            cy1: number,
            radius1: number,
        ): Pattern;
    }
}

Context.prototype.moveTo = function (x: number, y: number): Context {
    call(
        LIB,
        "cairo_move_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.lineTo = function (x: number, y: number): Context {
    call(
        LIB,
        "cairo_line_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.relMoveTo = function (dx: number, dy: number): Context {
    call(
        LIB,
        "cairo_rel_move_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx },
            { type: DOUBLE_TYPE, value: dy },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.relLineTo = function (dx: number, dy: number): Context {
    call(
        LIB,
        "cairo_rel_line_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx },
            { type: DOUBLE_TYPE, value: dy },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.relCurveTo = function (
    dx1: number,
    dy1: number,
    dx2: number,
    dy2: number,
    dx3: number,
    dy3: number,
): Context {
    call(
        LIB,
        "cairo_rel_curve_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx1 },
            { type: DOUBLE_TYPE, value: dy1 },
            { type: DOUBLE_TYPE, value: dx2 },
            { type: DOUBLE_TYPE, value: dy2 },
            { type: DOUBLE_TYPE, value: dx3 },
            { type: DOUBLE_TYPE, value: dy3 },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.curveTo = function (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Context {
    call(
        LIB,
        "cairo_curve_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x1 },
            { type: DOUBLE_TYPE, value: y1 },
            { type: DOUBLE_TYPE, value: x2 },
            { type: DOUBLE_TYPE, value: y2 },
            { type: DOUBLE_TYPE, value: x3 },
            { type: DOUBLE_TYPE, value: y3 },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.arc = function (xc: number, yc: number, radius: number, angle1: number, angle2: number): Context {
    call(
        LIB,
        "cairo_arc",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: xc },
            { type: DOUBLE_TYPE, value: yc },
            { type: DOUBLE_TYPE, value: radius },
            { type: DOUBLE_TYPE, value: angle1 },
            { type: DOUBLE_TYPE, value: angle2 },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.arcNegative = function (
    xc: number,
    yc: number,
    radius: number,
    angle1: number,
    angle2: number,
): Context {
    call(
        LIB,
        "cairo_arc_negative",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: xc },
            { type: DOUBLE_TYPE, value: yc },
            { type: DOUBLE_TYPE, value: radius },
            { type: DOUBLE_TYPE, value: angle1 },
            { type: DOUBLE_TYPE, value: angle2 },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.rectangle = function (x: number, y: number, width: number, height: number): Context {
    call(
        LIB,
        "cairo_rectangle",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
            { type: DOUBLE_TYPE, value: width },
            { type: DOUBLE_TYPE, value: height },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.closePath = function (): Context {
    call(LIB, "cairo_close_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.newPath = function (): Context {
    call(LIB, "cairo_new_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.newSubPath = function (): Context {
    call(LIB, "cairo_new_sub_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.stroke = function (): Context {
    call(LIB, "cairo_stroke", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.strokePreserve = function (): Context {
    call(LIB, "cairo_stroke_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.fill = function (): Context {
    call(LIB, "cairo_fill", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.fillPreserve = function (): Context {
    call(LIB, "cairo_fill_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.paint = function (): Context {
    call(LIB, "cairo_paint", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.paintWithAlpha = function (alpha: number): Context {
    call(
        LIB,
        "cairo_paint_with_alpha",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.clip = function (): Context {
    call(LIB, "cairo_clip", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.clipPreserve = function (): Context {
    call(LIB, "cairo_clip_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.resetClip = function (): Context {
    call(LIB, "cairo_reset_clip", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.setSourceRgb = function (red: number, green: number, blue: number): Context {
    call(
        LIB,
        "cairo_set_source_rgb",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setSourceRgba = function (red: number, green: number, blue: number, alpha: number): Context {
    call(
        LIB,
        "cairo_set_source_rgba",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setSource = function (pattern: Pattern): Context {
    call(
        LIB,
        "cairo_set_source",
        [
            { type: CAIRO_T, value: this.handle },
            { type: PATTERN_T_NONE, value: pattern.handle },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setLineWidth = function (width: number): Context {
    call(
        LIB,
        "cairo_set_line_width",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: width },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setLineCap = function (lineCap: LineCap): Context {
    call(
        LIB,
        "cairo_set_line_cap",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: lineCap },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setLineJoin = function (lineJoin: LineJoin): Context {
    call(
        LIB,
        "cairo_set_line_join",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: lineJoin },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setDash = function (dashes: number[], offset: number): Context {
    call(
        LIB,
        "cairo_set_dash",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "array", itemType: DOUBLE_TYPE, kind: "array", ownership: "full" }, value: dashes },
            { type: { type: "int", size: 32, unsigned: false }, value: dashes.length },
            { type: DOUBLE_TYPE, value: offset },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setFillRule = function (fillRule: FillRule): Context {
    call(
        LIB,
        "cairo_set_fill_rule",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: fillRule },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.getFillRule = function (): FillRule {
    return call(LIB, "cairo_get_fill_rule", [{ type: CAIRO_T, value: this.handle }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as FillRule;
};

Context.prototype.save = function (): Context {
    call(LIB, "cairo_save", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.restore = function (): Context {
    call(LIB, "cairo_restore", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Context.prototype.translate = function (tx: number, ty: number): Context {
    call(
        LIB,
        "cairo_translate",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: tx },
            { type: DOUBLE_TYPE, value: ty },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.scale = function (sx: number, sy: number): Context {
    call(
        LIB,
        "cairo_scale",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: sx },
            { type: DOUBLE_TYPE, value: sy },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.rotate = function (angle: number): Context {
    call(
        LIB,
        "cairo_rotate",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: angle },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setOperator = function (op: Operator): Context {
    call(
        LIB,
        "cairo_set_operator",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: op },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.selectFontFace = function (family: string, slant: FontSlant, weight: FontWeight): Context {
    call(
        LIB,
        "cairo_select_font_face",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: family },
            { type: { type: "int", size: 32, unsigned: false }, value: slant },
            { type: { type: "int", size: 32, unsigned: false }, value: weight },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.setFontSize = function (size: number): Context {
    call(
        LIB,
        "cairo_set_font_size",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: size },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.showText = function (text: string): Context {
    call(
        LIB,
        "cairo_show_text",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.textPath = function (text: string): Context {
    call(
        LIB,
        "cairo_text_path",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
        ],
        { type: "undefined" },
    );
    return this;
};

/**
 * Text extents returned by {@link Context.textExtents}.
 * All values are in user-space units.
 */
export type TextExtents = {
    /** Horizontal distance from the origin to the leftmost part of the glyphs */
    xBearing: number;
    /** Vertical distance from the origin to the topmost part of the glyphs */
    yBearing: number;
    /** Width of the glyphs as drawn */
    width: number;
    /** Height of the glyphs as drawn */
    height: number;
    /** Horizontal distance to advance after drawing the text */
    xAdvance: number;
    /** Vertical distance to advance after drawing the text */
    yAdvance: number;
};

Context.prototype.textExtents = function (text: string): TextExtents {
    const extents = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_text_extents",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
            {
                type: { type: "boxed", innerType: "cairo_text_extents_t", library: LIB, ownership: "borrowed" },
                value: extents,
            },
        ],
        { type: "undefined" },
    );
    return {
        xBearing: read(extents, DOUBLE_TYPE, 0) as number,
        yBearing: read(extents, DOUBLE_TYPE, 8) as number,
        width: read(extents, DOUBLE_TYPE, 16) as number,
        height: read(extents, DOUBLE_TYPE, 24) as number,
        xAdvance: read(extents, DOUBLE_TYPE, 32) as number,
        yAdvance: read(extents, DOUBLE_TYPE, 40) as number,
    };
};

Context.prototype.setFontOptions = function (options: FontOptions): Context {
    call(
        LIB,
        "cairo_set_font_options",
        [
            { type: CAIRO_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptions.create();
    call(
        LIB,
        "cairo_get_font_options",
        [
            { type: CAIRO_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        { type: "undefined" },
    );
    return options;
};

Context.prototype.setAntialias = function (antialias: Antialias): Context {
    call(
        LIB,
        "cairo_set_antialias",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: antialias },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.getAntialias = function (): Antialias {
    return call(LIB, "cairo_get_antialias", [{ type: CAIRO_T, value: this.handle }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as Antialias;
};

/** Type for Pattern class with static factory methods */
type PatternStatic = {
    createLinear(x0: number, y0: number, x1: number, y1: number): Pattern;
    createRadial(cx0: number, cy0: number, radius0: number, cx1: number, cy1: number, radius1: number): Pattern;
};

const PatternWithStatics = Pattern as typeof Pattern & PatternStatic;

PatternWithStatics.createLinear = (x0: number, y0: number, x1: number, y1: number): Pattern => {
    const ptr = call(
        LIB,
        "cairo_pattern_create_linear",
        [
            { type: DOUBLE_TYPE, value: x0 },
            { type: DOUBLE_TYPE, value: y0 },
            { type: DOUBLE_TYPE, value: x1 },
            { type: DOUBLE_TYPE, value: y1 },
        ],
        PATTERN_T,
    ) as NativeHandle;

    return getNativeObject(ptr, Pattern) as Pattern;
};

PatternWithStatics.createRadial = (
    cx0: number,
    cy0: number,
    radius0: number,
    cx1: number,
    cy1: number,
    radius1: number,
): Pattern => {
    const ptr = call(
        LIB,
        "cairo_pattern_create_radial",
        [
            { type: DOUBLE_TYPE, value: cx0 },
            { type: DOUBLE_TYPE, value: cy0 },
            { type: DOUBLE_TYPE, value: radius0 },
            { type: DOUBLE_TYPE, value: cx1 },
            { type: DOUBLE_TYPE, value: cy1 },
            { type: DOUBLE_TYPE, value: radius1 },
        ],
        PATTERN_T,
    );
    return getNativeObject(ptr as NativeHandle, Pattern) as Pattern;
};

Pattern.prototype.addColorStopRgb = function (offset: number, red: number, green: number, blue: number): Pattern {
    call(
        LIB,
        "cairo_pattern_add_color_stop_rgb",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: offset },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
        ],
        { type: "undefined" },
    );
    return this;
};

Pattern.prototype.addColorStopRgba = function (
    offset: number,
    red: number,
    green: number,
    blue: number,
    alpha: number,
): Pattern {
    call(
        LIB,
        "cairo_pattern_add_color_stop_rgba",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: offset },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
    return this;
};

(FontOptions as unknown as { create(): FontOptions }).create = (): FontOptions => {
    const ptr = call(LIB, "cairo_font_options_create", [], {
        type: "boxed",
        innerType: "CairoFontOptions",
        library: LIB_GOBJECT,
        getTypeFn: "cairo_gobject_font_options_get_type",
        ownership: "full",
    });
    return getNativeObject(ptr as NativeHandle, FontOptions);
};

FontOptions.prototype.setHintStyle = function (hintStyle: number): FontOptions {
    call(
        LIB,
        "cairo_font_options_set_hint_style",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: hintStyle },
        ],
        { type: "undefined" },
    );
    return this;
};

FontOptions.prototype.setAntialias = function (antialias: Antialias): FontOptions {
    call(
        LIB,
        "cairo_font_options_set_antialias",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: antialias },
        ],
        { type: "undefined" },
    );
    return this;
};

FontOptions.prototype.setHintMetrics = function (hintMetrics: number): FontOptions {
    call(
        LIB,
        "cairo_font_options_set_hint_metrics",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: hintMetrics },
        ],
        { type: "undefined" },
    );
    return this;
};

FontOptions.prototype.setSubpixelOrder = function (subpixelOrder: number): FontOptions {
    call(
        LIB,
        "cairo_font_options_set_subpixel_order",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: subpixelOrder },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.showPage = function (): Context {
    call(LIB, "cairo_show_page", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
    return this;
};

Surface.prototype.createContext = function (): Context {
    const ptr = call(LIB, "cairo_create", [{ type: SURFACE_T_NONE, value: this.handle }], CAIRO_T) as NativeHandle;
    return getNativeObject(ptr, Context) as Context;
};

Surface.prototype.finish = function (): void {
    call(LIB, "cairo_surface_finish", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

const CONTENT_MAP = {
    COLOR: 0x1000,
    ALPHA: 0x2000,
    COLOR_ALPHA: 0x3000,
} as const;

Surface.prototype.createSimilar = function (
    content: "COLOR" | "ALPHA" | "COLOR_ALPHA",
    width: number,
    height: number,
): Surface {
    const ptr = call(
        LIB,
        "cairo_surface_create_similar",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "int", size: 32, unsigned: false }, value: CONTENT_MAP[content] },
            { type: { type: "int", size: 32, unsigned: false }, value: width },
            { type: { type: "int", size: 32, unsigned: false }, value: height },
        ],
        SURFACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Context.prototype.getTarget = function (): Surface {
    const ptr = call(LIB, "cairo_get_target", [{ type: CAIRO_T, value: this.handle }], SURFACE_T_NONE) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Context.prototype.setSourceSurface = function (surface: Surface, x: number, y: number): Context {
    call(
        LIB,
        "cairo_set_source_surface",
        [
            { type: CAIRO_T, value: this.handle },
            { type: SURFACE_T_NONE, value: surface.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
    return this;
};

Context.prototype.getCurrentPoint = function (): { x: number; y: number } | null {
    const hasPoint = call(LIB, "cairo_has_current_point", [{ type: CAIRO_T, value: this.handle }], {
        type: "boolean",
    }) as boolean;

    if (!hasPoint) {
        return null;
    }

    const xRef = createRef(0.0);
    const yRef = createRef(0.0);

    call(
        LIB,
        "cairo_get_current_point",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );

    return {
        x: xRef.value,
        y: yRef.value,
    };
};

export class PdfSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    constructor(filename: string, widthInPoints: number, heightInPoints: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_pdf_surface_create",
            [
                { type: { type: "string", ownership: "full" }, value: filename },
                { type: DOUBLE_TYPE, value: widthInPoints },
                { type: DOUBLE_TYPE, value: heightInPoints },
            ],
            SURFACE_T,
        ) as NativeHandle;
    }
}

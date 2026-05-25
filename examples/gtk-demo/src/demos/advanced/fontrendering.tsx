import {
    Antialias,
    Content,
    Context,
    Filter,
    FontOptions,
    Format,
    HintMetrics,
    HintStyle,
    ImageSurface,
    Surface,
} from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDrawingArea,
    GtkDropDown,
    GtkEntry,
    GtkFontDialogButton,
    GtkGrid,
    GtkHeaderBar,
    GtkLabel,
    GtkScrolledWindow,
    GtkSeparator,
    GtkShortcutController,
    GtkToggleButton,
} from "@gtkx/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./fontrendering.tsx?raw";

const PANGO_SCALE = 1024;
const DEFAULT_TEXT = "Fonts render";

const enlargeGlyphWidths = (glyphString: Pango.GlyphString): void => {
    const glyphs = glyphString.glyphs;
    for (let i = 0; i < 4; i++) {
        const info = glyphs[2 * i];
        if (!info) continue;
        const geometry = info.geometry;
        geometry.width = Math.round((geometry.width * 3) / 2);
        info.geometry = geometry;
    }
    glyphString.glyphs = glyphs;
};

const applyGlyphOffsets = (glyphString: Pango.GlyphString, row: number): void => {
    const glyphs = glyphString.glyphs;
    for (let i = 0; i < 4; i++) {
        const info = glyphs[2 * i];
        if (!info) continue;
        const geometry = info.geometry;
        geometry.xOffset = Math.round((i * PANGO_SCALE) / 4);
        geometry.yOffset = Math.round((row * PANGO_SCALE) / 4);
        info.geometry = geometry;
    }
    glyphString.glyphs = glyphs;
};

type Mode = "text" | "grid";

interface OverlayState {
    showPixels: boolean;
    showOutlines: boolean;
    showExtents: boolean;
    showGrid: boolean;
}

const hintStyleOptions = [
    { id: "none", label: "None", value: HintStyle.NONE },
    { id: "slight", label: "Slight", value: HintStyle.SLIGHT },
    { id: "medium", label: "Medium", value: HintStyle.MEDIUM },
    { id: "full", label: "Full", value: HintStyle.FULL },
];

const ZWNJ = "‌";

const createGridFontOptions = (hintStyle: HintStyle, antialias: boolean, hintMetrics: boolean): FontOptions => {
    const fontOptions = FontOptions.create();
    fontOptions.setHintStyle(hintStyle);
    fontOptions.setAntialias(antialias ? Antialias.GRAY : Antialias.NONE);
    fontOptions.setHintMetrics(hintMetrics ? HintMetrics.ON : HintMetrics.OFF);
    return fontOptions;
};

const setupGridLayout = (
    context: Pango.Context,
    fontDesc: Pango.FontDescription,
    text: string,
): { logicalRect: Pango.Rectangle; ch: string; iter: Pango.LayoutIter } | null => {
    let ch = text[0] ?? " ";
    const layout = Pango.Layout.new(context);
    layout.setFontDescription(fontDesc);
    layout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);

    let [, logicalRect] = layout.getPixelExtents();
    const iter = layout.getIter();
    if (!iter) return null;
    const glyphItem = iter.getRun();
    if (!glyphItem?.glyphs) return null;

    if (glyphItem.glyphs.numGlyphs < 8) {
        ch = "a";
        layout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);
        [, logicalRect] = layout.getPixelExtents();
    }

    enlargeGlyphWidths(glyphItem.glyphs);
    return { logicalRect, ch, iter };
};

interface MeasurementInputs {
    text: string;
    fontDesc: Pango.FontDescription;
    hintStyle: HintStyle;
    antialias: boolean;
    hintMetrics: boolean;
    scale: number;
}

const withMeasurementContext = <T,>(inputs: MeasurementInputs, body: (pangoContext: Pango.Context) => T): T => {
    const fontOptions = createGridFontOptions(inputs.hintStyle, inputs.antialias, inputs.hintMetrics);
    const target = ImageSurface.create(Format.ARGB32, 1, 1);
    const cr = Context.create(target);
    cr.setFontOptions(fontOptions);
    const pangoContext = PangoCairo.createContext(cr);
    PangoCairo.contextSetFontOptions(pangoContext, fontOptions);
    pangoContext.setRoundGlyphPositions(inputs.hintMetrics);

    try {
        return body(pangoContext);
    } finally {
        target.finish();
    }
};

const measureTextSurface = (inputs: MeasurementInputs): { width: number; height: number } => {
    const { width, height } = withMeasurementContext(inputs, (pangoContext) => {
        const layout = Pango.Layout.new(pangoContext);
        layout.setFontDescription(inputs.fontDesc);
        layout.setText(inputs.text || " ", -1);
        const [inkRect] = layout.getExtents();
        const inkW = Math.ceil(inkRect.width / PANGO_SCALE);
        const inkH = Math.ceil(inkRect.height / PANGO_SCALE);
        return { width: inkW + 20, height: inkH + 20 };
    });
    return { width: width * inputs.scale, height: height * inputs.scale };
};

const measureGridSurface = (inputs: MeasurementInputs): { width: number; height: number } => {
    const result = withMeasurementContext(inputs, (pangoContext) => {
        const layoutSetup = setupGridLayout(pangoContext, inputs.fontDesc, inputs.text);
        if (!layoutSetup) return null;
        const { logicalRect } = layoutSetup;
        return {
            width: Math.round((logicalRect.width * 3) / 2),
            height: logicalRect.height * 4,
        };
    });
    if (!result) return { width: 0, height: 0 };
    return { width: result.width * inputs.scale, height: result.height * inputs.scale };
};

const renderSmallSurface = ({
    small,
    fontOptions,
    fontDesc,
    ch,
    hintMetrics,
}: {
    small: ReturnType<Context["getTarget"]>;
    fontOptions: FontOptions;
    fontDesc: Pango.FontDescription;
    ch: string;
    hintMetrics: boolean;
}): { iter: Pango.LayoutIter } | null => {
    const smallCr = Context.create(small);
    smallCr.setFontOptions(fontOptions);
    const smallCtx = PangoCairo.createContext(smallCr);
    PangoCairo.contextSetFontOptions(smallCtx, fontOptions);
    smallCtx.setRoundGlyphPositions(hintMetrics);

    const smallLayout = Pango.Layout.new(smallCtx);
    smallLayout.setFontDescription(fontDesc);
    smallLayout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);

    let [, smallLogical] = smallLayout.getPixelExtents();
    const smallIter = smallLayout.getIter();
    if (!smallIter) return null;
    const smallGlyphItem = smallIter.getRun();
    if (!smallGlyphItem?.glyphs) return null;

    if (smallGlyphItem.glyphs.numGlyphs < 8) {
        smallLayout.setText(`a${ZWNJ}a${ZWNJ}a${ZWNJ}a`, -1);
        [, smallLogical] = smallLayout.getPixelExtents();
    }

    enlargeGlyphWidths(smallGlyphItem.glyphs);

    smallCr.setSourceRgb(1, 1, 1);
    smallCr.paint();
    smallCr.setSourceRgb(0, 0, 0);

    for (let j = 0; j < 4; j++) {
        applyGlyphOffsets(smallGlyphItem.glyphs, j);

        smallCr.moveTo(0, j * smallLogical.height);
        PangoCairo.showLayout(smallCr, smallLayout);
    }
    return { iter: smallIter };
};

const paintSmallSurface = ({
    cr,
    small,
    surfaceWidth,
    surfaceHeight,
    scale,
    width,
    height,
}: {
    cr: Context;
    small: ReturnType<Context["getTarget"]>;
    surfaceWidth: number;
    surfaceHeight: number;
    scale: number;
    width: number;
    height: number;
}): void => {
    const scaledWidth = surfaceWidth * scale;
    const scaledHeight = surfaceHeight * scale;
    const offsetX = Math.max(0, Math.floor((width - scaledWidth) / 2));
    const offsetY = Math.max(0, Math.floor((height - scaledHeight) / 2));

    cr.save();
    cr.translate(offsetX, offsetY);
    cr.scale(scale, scale);
    cr.setSourceSurface(small, 0, 0);
    cr.getSource().setFilter(Filter.NEAREST);
    cr.paint();
    cr.restore();
};

function useFontRenderingState() {
    const [mode, setMode] = useState<Mode>("text");
    const [text, setText] = useState(DEFAULT_TEXT);
    const [fontDesc, setFontDesc] = useState(() => Pango.FontDescription.fromString("Sans 24"));
    const [hintStyle, setHintStyle] = useState<HintStyle>(HintStyle.NONE);
    const [antialias, setAntialias] = useState(true);
    const [hintMetrics, setHintMetrics] = useState(false);
    const [scale, setScale] = useState(7);
    const [overlays, setOverlays] = useState<OverlayState>({
        showPixels: true,
        showOutlines: false,
        showExtents: false,
        showGrid: false,
    });
    const pixelAlphaRef = useRef(1);
    const outlineAlphaRef = useRef(0);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);
    const tickIdRef = useRef<number | null>(null);

    return {
        mode,
        setMode,
        text,
        setText,
        fontDesc,
        setFontDesc,
        hintStyle,
        setHintStyle,
        antialias,
        setAntialias,
        hintMetrics,
        setHintMetrics,
        scale,
        setScale,
        overlays,
        setOverlays,
        pixelAlphaRef,
        outlineAlphaRef,
        drawingAreaRef,
        tickIdRef,
    };
}

type FontRenderingState = ReturnType<typeof useFontRenderingState>;

const easeOutCubic = (t: number) => {
    const p = t - 1;
    return p * p * p + 1;
};

const ANIMATION_DURATION_US = 500_000;

function useOverlayAnimation(state: FontRenderingState) {
    const { overlays, pixelAlphaRef, outlineAlphaRef, drawingAreaRef, tickIdRef } = state;

    useEffect(() => {
        const area = drawingAreaRef.current;
        if (!area) return;

        let targetPixelAlpha: number;
        if (overlays.showPixels && overlays.showOutlines) targetPixelAlpha = 0.5;
        else if (overlays.showPixels) targetPixelAlpha = 1;
        else targetPixelAlpha = 0;
        const targetOutlineAlpha = overlays.showOutlines ? 1 : 0;

        const startPixelAlpha = pixelAlphaRef.current;
        const startOutlineAlpha = outlineAlphaRef.current;
        if (startPixelAlpha === targetPixelAlpha && startOutlineAlpha === targetOutlineAlpha) return;

        if (tickIdRef.current !== null) {
            area.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }

        let startFrameTime: number | null = null;
        tickIdRef.current = area.addTickCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
            const frameTime = frameClock.getFrameTime();
            startFrameTime ??= frameTime;
            const t = Math.min((frameTime - startFrameTime) / ANIMATION_DURATION_US, 1);
            const eased = easeOutCubic(t);

            pixelAlphaRef.current = startPixelAlpha + (targetPixelAlpha - startPixelAlpha) * eased;
            outlineAlphaRef.current = startOutlineAlpha + (targetOutlineAlpha - startOutlineAlpha) * eased;
            area.queueDraw();

            if (t >= 1) {
                tickIdRef.current = null;
                return false;
            }
            return true;
        });

        return () => {
            if (tickIdRef.current !== null) {
                area.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
        };
    }, [overlays.showPixels, overlays.showOutlines, pixelAlphaRef, outlineAlphaRef, drawingAreaRef, tickIdRef]);
}

interface DrawTextModeContext {
    cr: Context;
    width: number;
    height: number;
    state: FontRenderingState;
    fontOptions: FontOptions;
    target: ReturnType<Context["getTarget"]>;
    inkPixel: { x: number; y: number; width: number; height: number };
    logicalRect: Pango.Rectangle;
    baseline: number;
    surfaceWidth: number;
    surfaceHeight: number;
}

const drawSmallSurface = (ctx: DrawTextModeContext) => {
    const { target, surfaceWidth, surfaceHeight, fontOptions, state, cr } = ctx;
    const small = Surface.createSimilar(target, Content.COLOR_ALPHA, surfaceWidth, surfaceHeight);
    const smallCr = Context.create(small);
    smallCr.setSourceRgb(1, 1, 1);
    smallCr.paint();
    smallCr.setFontOptions(fontOptions);
    const smallContext = PangoCairo.createContext(smallCr);
    PangoCairo.contextSetFontOptions(smallContext, fontOptions);
    smallContext.setRoundGlyphPositions(state.hintMetrics);

    const smallLayout = Pango.Layout.new(smallContext);
    smallLayout.setFontDescription(state.fontDesc);
    smallLayout.setText(state.text || " ", -1);

    smallCr.setSourceRgba(0, 0, 0, state.pixelAlphaRef.current);
    smallCr.translate(10, 10);
    PangoCairo.showLayout(smallCr, smallLayout);
    PangoCairo.layoutPath(smallCr, smallLayout);
    smallCr.save();
    smallCr.newPath();
    smallCr.restore();

    const scaledWidth = surfaceWidth * state.scale;
    const scaledHeight = surfaceHeight * state.scale;
    const offsetX = Math.max(0, Math.floor((ctx.width - scaledWidth) / 2));
    const offsetY = Math.max(0, Math.floor((ctx.height - scaledHeight) / 2));

    cr.save();
    cr.translate(offsetX, offsetY);
    cr.scale(state.scale, state.scale);
    cr.setSourceSurface(small, 0, 0);
    cr.getSource().setFilter(Filter.NEAREST);
    cr.paint();
    cr.restore();

    return { small, scaledWidth, scaledHeight, offsetX, offsetY };
};

const drawOverlays = (
    ctx: DrawTextModeContext,
    overlayInfo: { offsetX: number; offsetY: number; scaledWidth: number; scaledHeight: number },
) => {
    const { cr, state, surfaceWidth, surfaceHeight, logicalRect, baseline, inkPixel } = ctx;
    const { scale } = state;
    cr.save();
    cr.translate(overlayInfo.offsetX, overlayInfo.offsetY);
    cr.setLineWidth(1);

    if (state.overlays.showGrid) {
        cr.setSourceRgba(0.2, 0, 0, 0.2);
        for (let i = 1; i < surfaceHeight; i++) {
            cr.moveTo(0, scale * i - 0.5);
            cr.lineTo(overlayInfo.scaledWidth, scale * i - 0.5);
            cr.stroke();
        }
        for (let i = 1; i < surfaceWidth; i++) {
            cr.moveTo(scale * i - 0.5, 0);
            cr.lineTo(scale * i - 0.5, overlayInfo.scaledHeight);
            cr.stroke();
        }
    }

    if (state.overlays.showExtents) {
        drawExtents({ cr, scale, logicalRect, baseline, inkPixel });
    }

    if (state.outlineAlphaRef.current > 0) {
        drawOutlineLayer(ctx);
    }

    cr.restore();
};

const drawExtents = ({
    cr,
    scale,
    logicalRect,
    baseline,
    inkPixel,
}: {
    cr: Context;
    scale: number;
    logicalRect: Pango.Rectangle;
    baseline: number;
    inkPixel: { x: number; y: number; width: number; height: number };
}) => {
    const logX = logicalRect.x / PANGO_SCALE;
    const logY = logicalRect.y / PANGO_SCALE;
    const logW = logicalRect.width / PANGO_SCALE;
    const logH = logicalRect.height / PANGO_SCALE;
    const bl = baseline / PANGO_SCALE;

    cr.setSourceRgb(0, 0, 1);
    cr.rectangle(scale * (10 + logX) - 0.5, scale * (10 + logY) - 0.5, scale * logW + 1, scale * logH + 1);
    cr.stroke();

    cr.moveTo(scale * (10 + logX) - 0.5, scale * (10 + bl) - 0.5);
    cr.lineTo(scale * (10 + logX + logW) + 1, scale * (10 + bl) - 0.5);
    cr.stroke();

    cr.setSourceRgb(1, 0, 0);
    cr.rectangle(
        scale * (10 + inkPixel.x) - 0.5,
        scale * (10 + inkPixel.y) - 0.5,
        scale * inkPixel.width + 1,
        scale * inkPixel.height + 1,
    );
    cr.stroke();
};

const drawOutlineLayer = (ctx: DrawTextModeContext) => {
    const { target, surfaceWidth, surfaceHeight, fontOptions, state, cr } = ctx;
    const outlineSurface = Surface.createSimilar(target, Content.COLOR_ALPHA, surfaceWidth, surfaceHeight);
    const outlineCr = Context.create(outlineSurface);
    outlineCr.setFontOptions(fontOptions);
    const outlineCtx = PangoCairo.createContext(outlineCr);
    PangoCairo.contextSetFontOptions(outlineCtx, fontOptions);
    outlineCtx.setRoundGlyphPositions(state.hintMetrics);

    const outlineLayout = Pango.Layout.new(outlineCtx);
    outlineLayout.setFontDescription(state.fontDesc);
    outlineLayout.setText(state.text || " ", -1);

    outlineCr.translate(10, 10);
    PangoCairo.layoutPath(outlineCr, outlineLayout);
    outlineCr.setSourceRgba(0, 0, 0, 1);
    outlineCr.setLineWidth(1);
    outlineCr.stroke();

    cr.scale(state.scale, state.scale);
    cr.setSourceSurface(outlineSurface, 0, 0);
    cr.getSource().setFilter(Filter.NEAREST);
    cr.paintWithAlpha(state.outlineAlphaRef.current);

    outlineSurface.finish();
};

interface ComputeTextLayoutArgs {
    cr: Context;
    width: number;
    height: number;
    fontOptions: FontOptions;
    fontDesc: Pango.FontDescription;
    text: string;
    hintMetrics: boolean;
}

const computeTextLayout = ({ cr, width, height, fontOptions, fontDesc, text, hintMetrics }: ComputeTextLayoutArgs) => {
    const target = cr.getTarget();
    const offscreen = Surface.createSimilar(target, Content.COLOR_ALPHA, width, height);
    const offCr = Context.create(offscreen);
    offCr.setFontOptions(fontOptions);

    const context = PangoCairo.createContext(offCr);
    PangoCairo.contextSetFontOptions(context, fontOptions);
    context.setRoundGlyphPositions(hintMetrics);

    const layout = Pango.Layout.new(context);
    layout.setFontDescription(fontDesc);
    layout.setText(text || " ", -1);

    const [inkRect, logicalRect] = layout.getExtents();
    const baseline = layout.getBaseline();

    const inkPixel = {
        x: Math.floor(inkRect.x / PANGO_SCALE),
        y: Math.floor(inkRect.y / PANGO_SCALE),
        width: Math.ceil(inkRect.width / PANGO_SCALE),
        height: Math.ceil(inkRect.height / PANGO_SCALE),
    };

    return { inkPixel, logicalRect, baseline, target };
};

function useDrawTextMode(state: FontRenderingState) {
    const { fontDesc, text, hintStyle, antialias, hintMetrics } = state;

    return useCallback(
        (cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1);
            cr.paint();

            const fontOptions = createGridFontOptions(hintStyle, antialias, hintMetrics);
            const { inkPixel, logicalRect, baseline, target } = computeTextLayout({
                cr,
                width,
                height,
                fontOptions,
                fontDesc,
                text,
                hintMetrics,
            });

            const surfaceWidth = inkPixel.width + 20;
            const surfaceHeight = inkPixel.height + 20;

            const ctx: DrawTextModeContext = {
                cr,
                width,
                height,
                state,
                fontOptions,
                target,
                inkPixel,
                logicalRect,
                baseline,
                surfaceWidth,
                surfaceHeight,
            };
            const { small, scaledWidth, scaledHeight, offsetX, offsetY } = drawSmallSurface(ctx);
            drawOverlays(ctx, { offsetX, offsetY, scaledWidth, scaledHeight });
            small.finish();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, state],
    );
}

function useDrawGridMode(state: FontRenderingState) {
    const { fontDesc, text, hintStyle, antialias, hintMetrics, scale } = state;

    return useCallback(
        (cr: Context, width: number, height: number) => {
            const fontOptions = createGridFontOptions(hintStyle, antialias, hintMetrics);
            const target = cr.getTarget();
            const tmpSurface = Surface.createSimilar(target, Content.COLOR_ALPHA, 1, 1);
            const tmpCr = Context.create(tmpSurface);
            tmpCr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(tmpCr);
            PangoCairo.contextSetFontOptions(context, fontOptions);
            context.setRoundGlyphPositions(hintMetrics);

            const layoutSetup = setupGridLayout(context, fontDesc, text);
            if (!layoutSetup) return;
            const { logicalRect, ch } = layoutSetup;

            const surfaceWidth = Math.round((logicalRect.width * 3) / 2);
            const surfaceHeight = logicalRect.height * 4;
            const small = Surface.createSimilar(target, Content.COLOR_ALPHA, surfaceWidth, surfaceHeight);
            const smallSetup = renderSmallSurface({ small, fontOptions, fontDesc, ch, hintMetrics });
            if (!smallSetup) {
                small.finish();
                tmpSurface.finish();
                return;
            }

            cr.setSourceRgb(1, 1, 1);
            cr.paint();
            paintSmallSurface({ cr, small, surfaceWidth, surfaceHeight, scale, width, height });

            small.finish();
            tmpSurface.finish();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, scale],
    );
}

const FontRenderingTitlebar = () => {
    const { state } = useFontRendering();
    const { mode, setMode } = state;
    const [textToggle, setTextToggle] = useState<Gtk.ToggleButton | null>(null);
    return (
        <GtkHeaderBar
            name="fontrendering-header"
            titleWidget={
                <GtkBox cssClasses={["linked"]}>
                    <GtkToggleButton
                        ref={setTextToggle}
                        label="Text"
                        active={mode === "text"}
                        onToggled={(btn) => {
                            if (btn.getActive()) setMode("text");
                        }}
                    />
                    <GtkToggleButton
                        label="Grid"
                        group={textToggle}
                        active={mode === "grid"}
                        onToggled={(btn) => {
                            if (btn.getActive()) setMode("grid");
                        }}
                    />
                </GtkBox>
            }
        />
    );
};

interface FontRenderingControlsProps {
    state: FontRenderingState;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

const FontRenderingControls = ({ state, onZoomIn, onZoomOut }: FontRenderingControlsProps) => (
    <GtkGrid halign={Gtk.Align.CENTER} marginTop={10} marginBottom={10} rowSpacing={10} columnSpacing={10}>
        <FontRenderingTextRow state={state} />
        <FontRenderingOverlayChecks state={state} />
        <FontRenderingHintControls state={state} />
        <FontRenderingExtraOverlays state={state} />
        <FontRenderingZoomButtons state={state} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
        <GtkGrid.Child column={8} row={0}>
            <GtkLabel label="" hexpand />
        </GtkGrid.Child>
    </GtkGrid>
);

const FontRenderingTextRow = ({ state }: { state: FontRenderingState }) => {
    const { text, setText, fontDesc, setFontDesc } = state;
    return (
        <>
            <GtkGrid.Child column={1} row={0}>
                <GtkLabel label="Text" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
            </GtkGrid.Child>
            <GtkGrid.Child column={2} row={0}>
                <GtkEntry name="entry" text={text} onChanged={(entry) => setText(entry.getText())} />
            </GtkGrid.Child>
            <GtkGrid.Child column={1} row={1}>
                <GtkLabel label="Font" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
            </GtkGrid.Child>
            <GtkGrid.Child column={2} row={1}>
                <GtkFontDialogButton fontDesc={fontDesc} onFontDescChanged={setFontDesc} />
            </GtkGrid.Child>
        </>
    );
};

const FontRenderingOverlayChecks = ({ state }: { state: FontRenderingState }) => {
    const { overlays, setOverlays } = state;
    return (
        <>
            <GtkGrid.Child column={3} row={0}>
                <GtkCheckButton
                    label="Show _Pixels"
                    useUnderline
                    active={overlays.showPixels}
                    onToggled={(btn) => setOverlays((o) => ({ ...o, showPixels: btn.getActive() }))}
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={3} row={1}>
                <GtkCheckButton
                    label="Show _Outline"
                    useUnderline
                    active={overlays.showOutlines}
                    onToggled={(btn) => setOverlays((o) => ({ ...o, showOutlines: btn.getActive() }))}
                />
            </GtkGrid.Child>
        </>
    );
};

const FontRenderingHintControls = ({ state }: { state: FontRenderingState }) => {
    const { hintStyle, setHintStyle, antialias, setAntialias, hintMetrics, setHintMetrics } = state;
    return (
        <>
            <GtkGrid.Child column={4} row={0} columnSpan={2}>
                <GtkBox spacing={6}>
                    <GtkLabel label="_Hinting" useUnderline cssClasses={["dim-label"]} />
                    <GtkDropDown
                        name="hinting"
                        valign={Gtk.Align.CENTER}
                        selectedId={hintStyleOptions.find((o) => o.value === hintStyle)?.id}
                        onSelectionChanged={(id) => {
                            const opt = hintStyleOptions.find((o) => o.id === id);
                            if (opt) setHintStyle(opt.value);
                        }}
                        items={hintStyleOptions.map((opt) => ({ id: opt.id, value: opt.label }))}
                    />
                </GtkBox>
            </GtkGrid.Child>
            <GtkGrid.Child column={4} row={1}>
                <GtkCheckButton
                    label="_Antialias"
                    useUnderline
                    active={antialias}
                    onToggled={(btn) => setAntialias(btn.getActive())}
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={5} row={1}>
                <GtkCheckButton
                    label="Hint _Metrics"
                    useUnderline
                    active={hintMetrics}
                    onToggled={(btn) => setHintMetrics(btn.getActive())}
                />
            </GtkGrid.Child>
        </>
    );
};

const FontRenderingExtraOverlays = ({ state }: { state: FontRenderingState }) => {
    const { overlays, setOverlays } = state;
    return (
        <>
            <GtkGrid.Child column={6} row={0}>
                <GtkCheckButton
                    label="Show _Extents"
                    useUnderline
                    active={overlays.showExtents}
                    onToggled={(btn) => setOverlays((o) => ({ ...o, showExtents: btn.getActive() }))}
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={6} row={1}>
                <GtkCheckButton
                    label="Show _Grid"
                    useUnderline
                    active={overlays.showGrid}
                    onToggled={(btn) => setOverlays((o) => ({ ...o, showGrid: btn.getActive() }))}
                />
            </GtkGrid.Child>
        </>
    );
};

const FontRenderingZoomButtons = ({
    state,
    onZoomIn,
    onZoomOut,
}: {
    state: FontRenderingState;
    onZoomIn: () => void;
    onZoomOut: () => void;
}) => {
    const { scale } = state;
    return (
        <>
            <GtkGrid.Child column={7} row={0}>
                <GtkButton
                    name="up_button"
                    iconName="list-add-symbolic"
                    onClicked={onZoomIn}
                    sensitive={scale < 32}
                    cssClasses={["circular"]}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    accessibleLabel="Zoom in"
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={7} row={1}>
                <GtkButton
                    name="down_button"
                    iconName="list-remove-symbolic"
                    onClicked={onZoomOut}
                    sensitive={scale > 1}
                    cssClasses={["circular"]}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    accessibleLabel="Zoom out"
                />
            </GtkGrid.Child>
        </>
    );
};

interface FontRenderingContextValue {
    state: FontRenderingState;
    drawFunc: (cr: Context, width: number, height: number) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    naturalSize: { width: number; height: number };
}

const FontRenderingContext = createContext<FontRenderingContextValue | null>(null);

const useFontRendering = (): FontRenderingContextValue => {
    const ctx = useContext(FontRenderingContext);
    if (!ctx) throw new Error("useFontRendering must be used inside a FontRenderingProvider");
    return ctx;
};

const FontRenderingProvider = ({ children }: DemoProviderProps) => {
    const state = useFontRenderingState();
    const { mode, text, fontDesc, hintStyle, antialias, hintMetrics, scale, setScale } = state;

    useOverlayAnimation(state);

    const drawTextMode = useDrawTextMode(state);
    const drawGridMode = useDrawGridMode(state);
    const drawFunc = mode === "text" ? drawTextMode : drawGridMode;

    const naturalSize = useMemo(() => {
        const inputs: MeasurementInputs = { text, fontDesc, hintStyle, antialias, hintMetrics, scale };
        return mode === "text" ? measureTextSurface(inputs) : measureGridSurface(inputs);
    }, [mode, text, fontDesc, hintStyle, antialias, hintMetrics, scale]);

    const zoomIn = useCallback(() => setScale((s) => Math.min(32, s + 1)), [setScale]);
    const zoomOut = useCallback(() => setScale((s) => Math.max(1, s - 1)), [setScale]);

    return (
        <FontRenderingContext.Provider value={{ state, drawFunc, zoomIn, zoomOut, naturalSize }}>
            {children}
        </FontRenderingContext.Provider>
    );
};

const FontRenderingDemo = () => {
    const { state, drawFunc, zoomIn, zoomOut, naturalSize } = useFontRendering();

    return (
        <>
            <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                <GtkShortcutController.Shortcut trigger="<Control>plus" onActivate={zoomIn} />
                <GtkShortcutController.Shortcut trigger="<Control>minus" onActivate={zoomOut} />
            </GtkShortcutController>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                <FontRenderingControls state={state} onZoomIn={zoomIn} onZoomOut={zoomOut} />
                <GtkSeparator />
                <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                    <GtkDrawingArea
                        name="image"
                        ref={state.drawingAreaRef}
                        render={drawFunc}
                        contentWidth={naturalSize.width}
                        contentHeight={naturalSize.height}
                        hexpand
                        vexpand
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        accessibleLabel="Font rendering example"
                    />
                </GtkScrolledWindow>
            </GtkBox>
        </>
    );
};

export const fontRenderingDemo: Demo = {
    id: "fontrendering",
    title: "Pango/Font Rendering",
    description:
        "Demonstrates various aspects of font rendering, such as hinting, antialiasing and grid alignment.\n\nThe demo lets you explore font rendering options interactively to get a feeling for they affect the shape and positioning of the glyphs.",
    keywords: [],
    component: FontRenderingDemo,
    titlebar: FontRenderingTitlebar,
    provider: FontRenderingProvider,
    sourceCode,
    defaultWidth: 1024,
    defaultHeight: 768,
};

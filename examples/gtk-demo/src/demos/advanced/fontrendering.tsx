import type { NativeHandle } from "@gtkx/ffi";
import { read, write } from "@gtkx/ffi";
import { Antialias, Context, Filter, FontOptions, HintMetrics, HintStyle } from "@gtkx/ffi/cairo";
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

const Slot = "Slot" as const;

import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fontrendering.tsx?raw";

const PANGO_SCALE = 1024;
const DEFAULT_TEXT = "Fonts render";
const GLYPH_INFO_SIZE = 24;
const U32 = { type: "uint32" } as const;
const I32 = { type: "int32" } as const;
const GLYPHS_STRUCT = (numGlyphs: number) =>
    ({ type: "struct", innerType: "PangoGlyphInfo", size: numGlyphs * GLYPH_INFO_SIZE, ownership: "full" }) as const;

type GlyphData = { glyph: number; width: number; xOffset: number; yOffset: number; attr: number };

const readGlyphsArray = (glyphString: Pango.GlyphString): NativeHandle =>
    read(glyphString.handle, GLYPHS_STRUCT(glyphString.numGlyphs), 8) as NativeHandle;

const readGlyph = (glyphsArray: NativeHandle, index: number): GlyphData => {
    const base = index * GLYPH_INFO_SIZE;
    return {
        glyph: read(glyphsArray, U32, base) as number,
        width: read(glyphsArray, I32, base + 4) as number,
        xOffset: read(glyphsArray, I32, base + 8) as number,
        yOffset: read(glyphsArray, I32, base + 12) as number,
        attr: read(glyphsArray, U32, base + 16) as number,
    };
};

const writeGlyph = (glyphsArray: NativeHandle, index: number, g: GlyphData): void => {
    const base = index * GLYPH_INFO_SIZE;
    write(glyphsArray, U32, base, g.glyph);
    write(glyphsArray, I32, base + 4, g.width);
    write(glyphsArray, I32, base + 8, g.xOffset);
    write(glyphsArray, I32, base + 12, g.yOffset);
    write(glyphsArray, U32, base + 16, g.attr);
};

const commitGlyphs = (glyphString: Pango.GlyphString, glyphsArray: NativeHandle): void => {
    write(glyphString.handle, GLYPHS_STRUCT(glyphString.numGlyphs), 8, glyphsArray);
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

const FontRenderingDemo = () => {
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

    const [pixelAlpha, setPixelAlpha] = useState(1);
    const [outlineAlpha, setOutlineAlpha] = useState(0);
    const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const targetPixelAlpha = overlays.showPixels && overlays.showOutlines ? 0.5 : overlays.showPixels ? 1 : 0;
        const targetOutlineAlpha = overlays.showOutlines ? 1 : 0;

        if (pixelAlpha === targetPixelAlpha && outlineAlpha === targetOutlineAlpha) return;

        const startPixelAlpha = pixelAlpha;
        const startOutlineAlpha = outlineAlpha;
        const startTime = Date.now();
        const duration = 500;

        const easeOutCubic = (t: number) => {
            const p = t - 1;
            return p * p * p + 1;
        };

        if (animationRef.current) {
            clearInterval(animationRef.current);
        }

        animationRef.current = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(t);

            setPixelAlpha(startPixelAlpha + (targetPixelAlpha - startPixelAlpha) * eased);
            setOutlineAlpha(startOutlineAlpha + (targetOutlineAlpha - startOutlineAlpha) * eased);

            if (t >= 1 && animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        }, 16);

        return () => {
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [overlays.showPixels, overlays.showOutlines, outlineAlpha, pixelAlpha]);

    const drawTextMode = useCallback(
        (cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1);
            cr.paint();

            const fontOptions = new FontOptions();
            fontOptions.setHintStyle(hintStyle);
            fontOptions.setAntialias(antialias ? Antialias.GRAY : Antialias.NONE);
            fontOptions.setHintMetrics(hintMetrics ? HintMetrics.ON : HintMetrics.OFF);

            const target = cr.getTarget();
            const offscreen = target.createSimilar("COLOR_ALPHA", width, height);
            const offCr = new Context(offscreen);

            offCr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(offCr);
            PangoCairo.contextSetFontOptions(context, fontOptions);
            context.setRoundGlyphPositions(hintMetrics);

            const layout = new Pango.Layout(context);
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

            const surfaceWidth = inkPixel.width + 20;
            const surfaceHeight = inkPixel.height + 20;

            const small = target.createSimilar("COLOR_ALPHA", surfaceWidth, surfaceHeight);
            const smallCr = new Context(small);

            smallCr.setSourceRgb(1, 1, 1);
            smallCr.paint();

            smallCr.setFontOptions(fontOptions);
            const smallContext = PangoCairo.createContext(smallCr);
            PangoCairo.contextSetFontOptions(smallContext, fontOptions);
            smallContext.setRoundGlyphPositions(hintMetrics);

            const smallLayout = new Pango.Layout(smallContext);
            smallLayout.setFontDescription(fontDesc);
            smallLayout.setText(text || " ", -1);

            smallCr.setSourceRgba(0, 0, 0, pixelAlpha);
            smallCr.translate(10, 10);
            PangoCairo.showLayout(smallCr, smallLayout);

            PangoCairo.layoutPath(smallCr, smallLayout);

            smallCr.save();
            smallCr.newPath();
            smallCr.restore();

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

            cr.save();
            cr.translate(offsetX, offsetY);
            cr.setLineWidth(1);

            if (overlays.showGrid) {
                cr.setSourceRgba(0.2, 0, 0, 0.2);
                for (let i = 1; i < surfaceHeight; i++) {
                    cr.moveTo(0, scale * i - 0.5);
                    cr.lineTo(scaledWidth, scale * i - 0.5);
                    cr.stroke();
                }
                for (let i = 1; i < surfaceWidth; i++) {
                    cr.moveTo(scale * i - 0.5, 0);
                    cr.lineTo(scale * i - 0.5, scaledHeight);
                    cr.stroke();
                }
            }

            if (overlays.showExtents) {
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
            }

            if (outlineAlpha > 0) {
                const outlineSurface = target.createSimilar("COLOR_ALPHA", surfaceWidth, surfaceHeight);
                const outlineCr = new Context(outlineSurface);
                outlineCr.setFontOptions(fontOptions);
                const outlineCtx = PangoCairo.createContext(outlineCr);
                PangoCairo.contextSetFontOptions(outlineCtx, fontOptions);
                outlineCtx.setRoundGlyphPositions(hintMetrics);

                const outlineLayout = new Pango.Layout(outlineCtx);
                outlineLayout.setFontDescription(fontDesc);
                outlineLayout.setText(text || " ", -1);

                outlineCr.translate(10, 10);
                PangoCairo.layoutPath(outlineCr, outlineLayout);
                outlineCr.setSourceRgba(0, 0, 0, 1);
                outlineCr.setLineWidth(1);
                outlineCr.stroke();

                cr.scale(scale, scale);
                cr.setSourceSurface(outlineSurface, 0, 0);
                cr.getSource().setFilter(Filter.NEAREST);
                cr.paintWithAlpha(outlineAlpha);

                outlineSurface.finish();
            }

            cr.restore();

            small.finish();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, scale, overlays, pixelAlpha, outlineAlpha],
    );

    const drawGridMode = useCallback(
        (cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1);
            cr.paint();

            const fontOptions = new FontOptions();
            fontOptions.setHintStyle(hintStyle);
            fontOptions.setAntialias(antialias ? Antialias.GRAY : Antialias.NONE);
            fontOptions.setHintMetrics(hintMetrics ? HintMetrics.ON : HintMetrics.OFF);

            const target = cr.getTarget();

            const tmpSurface = target.createSimilar("COLOR_ALPHA", 1, 1);
            const tmpCr = new Context(tmpSurface);
            tmpCr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(tmpCr);
            PangoCairo.contextSetFontOptions(context, fontOptions);
            context.setRoundGlyphPositions(hintMetrics);

            let ch = text.length > 0 ? text[0] : " ";

            const ZWNJ = "\u200C";
            const glyphText = `${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`;

            const layout = new Pango.Layout(context);
            layout.setFontDescription(fontDesc);
            layout.setText(glyphText, -1);

            let [, logicalRect] = layout.getPixelExtents();

            const iter = layout.getIter();
            if (!iter) return;

            const glyphItem = iter.getRun();
            if (!glyphItem) return;

            const glyphString = glyphItem.glyphs;
            if (!glyphString) return;

            if (glyphString.numGlyphs < 8) {
                ch = "a";
                layout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);
                [, logicalRect] = layout.getPixelExtents();
            }

            const glyphs = readGlyphsArray(glyphString);
            for (let i = 0; i < 4; i++) {
                const g = readGlyph(glyphs, 2 * i);
                writeGlyph(glyphs, 2 * i, { ...g, width: Math.round((g.width * 3) / 2) });
            }
            commitGlyphs(glyphString, glyphs);

            const surfaceWidth = Math.round((logicalRect.width * 3) / 2);
            const surfaceHeight = logicalRect.height * 4;

            const small = target.createSimilar("COLOR_ALPHA", surfaceWidth, surfaceHeight);
            const smallCr = new Context(small);
            smallCr.setFontOptions(fontOptions);

            const smallCtx = PangoCairo.createContext(smallCr);
            PangoCairo.contextSetFontOptions(smallCtx, fontOptions);
            smallCtx.setRoundGlyphPositions(hintMetrics);

            const smallLayout = new Pango.Layout(smallCtx);
            smallLayout.setFontDescription(fontDesc);

            const smallGlyphText = `${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`;
            smallLayout.setText(smallGlyphText, -1);

            let [, smallLogical] = smallLayout.getPixelExtents();

            const smallIter = smallLayout.getIter();
            if (!smallIter) return;
            const smallGlyphItem = smallIter.getRun();
            if (!smallGlyphItem) return;

            const smallGlyphString = smallGlyphItem.glyphs;
            if (!smallGlyphString) return;

            if (smallGlyphString.numGlyphs < 8) {
                smallLayout.setText(`a${ZWNJ}a${ZWNJ}a${ZWNJ}a`, -1);
                [, smallLogical] = smallLayout.getPixelExtents();
            }

            const smallGlyphs = readGlyphsArray(smallGlyphString);
            for (let i = 0; i < 4; i++) {
                const g = readGlyph(smallGlyphs, 2 * i);
                writeGlyph(smallGlyphs, 2 * i, { ...g, width: Math.round((g.width * 3) / 2) });
            }
            commitGlyphs(smallGlyphString, smallGlyphs);

            smallCr.setSourceRgb(1, 1, 1);
            smallCr.paint();
            smallCr.setSourceRgb(0, 0, 0);

            for (let j = 0; j < 4; j++) {
                const offsetGlyphs = readGlyphsArray(smallGlyphString);
                for (let i = 0; i < 4; i++) {
                    const g = readGlyph(offsetGlyphs, 2 * i);
                    writeGlyph(offsetGlyphs, 2 * i, {
                        ...g,
                        xOffset: Math.round((i * PANGO_SCALE) / 4),
                        yOffset: Math.round((j * PANGO_SCALE) / 4),
                    });
                }
                commitGlyphs(smallGlyphString, offsetGlyphs);

                smallCr.moveTo(0, j * smallLogical.height);
                PangoCairo.showLayout(smallCr, smallLayout);
            }

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

            smallIter.free();
            small.finish();
            tmpSurface.finish();

            iter.free();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, scale],
    );

    const drawFunc = mode === "text" ? drawTextMode : drawGridMode;

    const zoomIn = useCallback(() => setScale((s) => Math.min(32, s + 1)), []);
    const zoomOut = useCallback(() => setScale((s) => Math.max(1, s - 1)), []);

    return (
        <>
            <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                <GtkShortcutController.Shortcut trigger="<Control>plus" onActivate={zoomIn} />
                <GtkShortcutController.Shortcut trigger="<Control>minus" onActivate={zoomOut} />
            </GtkShortcutController>
            <Slot id="titlebar">
                <GtkHeaderBar
                    titleWidget={
                        <GtkBox cssClasses={["linked"]}>
                            <GtkToggleButton label="Text" active={mode === "text"} onToggled={() => setMode("text")} />
                            <GtkToggleButton label="Grid" active={mode === "grid"} onToggled={() => setMode("grid")} />
                        </GtkBox>
                    }
                ></GtkHeaderBar>
            </Slot>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                <GtkGrid halign={Gtk.Align.CENTER} marginTop={10} marginBottom={10} rowSpacing={10} columnSpacing={10}>
                    <GtkGrid.Child column={1} row={0}>
                        <GtkLabel label="Text" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
                    </GtkGrid.Child>
                    <GtkGrid.Child column={2} row={0}>
                        <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} />
                    </GtkGrid.Child>
                    <GtkGrid.Child column={1} row={1}>
                        <GtkLabel label="Font" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
                    </GtkGrid.Child>
                    <GtkGrid.Child column={2} row={1}>
                        <GtkFontDialogButton fontDesc={fontDesc} onFontDescChanged={setFontDesc} />
                    </GtkGrid.Child>
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
                    <GtkGrid.Child column={4} row={0} columnSpan={2}>
                        <GtkBox spacing={6}>
                            <GtkLabel label="_Hinting" useUnderline cssClasses={["dim-label"]} />
                            <GtkDropDown
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
                    <GtkGrid.Child column={7} row={0}>
                        <GtkButton
                            iconName="list-add-symbolic"
                            onClicked={zoomIn}
                            sensitive={scale < 32}
                            cssClasses={["circular"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Zoom in"
                        />
                    </GtkGrid.Child>
                    <GtkGrid.Child column={7} row={1}>
                        <GtkButton
                            iconName="list-remove-symbolic"
                            onClicked={zoomOut}
                            sensitive={scale > 1}
                            cssClasses={["circular"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Zoom out"
                        />
                    </GtkGrid.Child>
                    <GtkGrid.Child column={8} row={0}>
                        <GtkLabel label="" hexpand />
                    </GtkGrid.Child>
                </GtkGrid>

                <GtkSeparator />
                <GtkScrolledWindow hexpand vexpand>
                    <GtkDrawingArea render={drawFunc} vexpand hexpand accessibleLabel="Font rendering example" />
                </GtkScrolledWindow>
            </GtkBox>
        </>
    );
};

export const fontRenderingDemo: Demo = {
    id: "fontrendering",
    title: "Pango/Font Rendering",
    description: "Explore font rendering options: hinting, antialiasing, and subpixel rendering",
    keywords: ["font", "rendering", "hinting", "antialiasing", "subpixel", "cairo", "pango", "text", "typography"],
    component: FontRenderingDemo,
    sourceCode,
    defaultWidth: 1024,
    defaultHeight: 768,
};

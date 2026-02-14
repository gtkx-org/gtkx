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
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fontrendering.tsx?raw";

const PANGO_SCALE = 1024;
const DEFAULT_TEXT = "Fonts render";

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

    const [pixelAlpha, setPixelAlpha] = useState(1.0);
    const [outlineAlpha, setOutlineAlpha] = useState(0.0);
    const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const targetPixelAlpha = overlays.showPixels && overlays.showOutlines ? 0.5 : overlays.showPixels ? 1.0 : 0.0;
        const targetOutlineAlpha = overlays.showOutlines ? 1.0 : 0.0;

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

            const inkRect = new Pango.Rectangle();
            const logicalRect = new Pango.Rectangle();
            layout.getExtents(inkRect, logicalRect);
            const baseline = layout.getBaseline();

            const inkPixel = {
                x: Math.floor(inkRect.getX() / PANGO_SCALE),
                y: Math.floor(inkRect.getY() / PANGO_SCALE),
                width: Math.ceil(inkRect.getWidth() / PANGO_SCALE),
                height: Math.ceil(inkRect.getHeight() / PANGO_SCALE),
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
                const logX = logicalRect.getX() / PANGO_SCALE;
                const logY = logicalRect.getY() / PANGO_SCALE;
                const logW = logicalRect.getWidth() / PANGO_SCALE;
                const logH = logicalRect.getHeight() / PANGO_SCALE;
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

            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);

            const iter = layout.getIter();
            if (!iter) return;

            const glyphItem = iter.getRun();
            if (!glyphItem) return;

            const glyphString = glyphItem.getGlyphs();
            if (!glyphString) return;

            if (glyphString.getNumGlyphs() < 8) {
                ch = "a";
                layout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);
                layout.getPixelExtents(undefined, logicalRect);
            }

            for (let i = 0; i < 4; i++) {
                const g = glyphString.getGlyph(2 * i);
                const geom = g.getGeometry();
                const newGlyph = new Pango.GlyphInfo({
                    glyph: g.getGlyph(),
                    geometry: new Pango.GlyphGeometry({
                        width: Math.round((geom.getWidth() * 3) / 2),
                        xOffset: geom.getXOffset(),
                        yOffset: geom.getYOffset(),
                    }),
                    attr: g.getAttr(),
                });
                glyphString.setGlyph(2 * i, newGlyph);
            }

            const surfaceWidth = Math.round((logicalRect.getWidth() * 3) / 2);
            const surfaceHeight = logicalRect.getHeight() * 4;

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

            const smallLogical = new Pango.Rectangle();
            smallLayout.getPixelExtents(undefined, smallLogical);

            const smallIter = smallLayout.getIter();
            if (!smallIter) return;
            const smallGlyphItem = smallIter.getRun();
            if (!smallGlyphItem) return;

            const smallGlyphString = smallGlyphItem.getGlyphs();
            if (!smallGlyphString) return;

            if (smallGlyphString.getNumGlyphs() < 8) {
                smallLayout.setText(`a${ZWNJ}a${ZWNJ}a${ZWNJ}a`, -1);
                smallLayout.getPixelExtents(undefined, smallLogical);
            }

            for (let i = 0; i < 4; i++) {
                const g = smallGlyphString.getGlyph(2 * i);
                const geom = g.getGeometry();
                const newGlyph = new Pango.GlyphInfo({
                    glyph: g.getGlyph(),
                    geometry: new Pango.GlyphGeometry({
                        width: Math.round((geom.getWidth() * 3) / 2),
                        xOffset: geom.getXOffset(),
                        yOffset: geom.getYOffset(),
                    }),
                    attr: g.getAttr(),
                });
                smallGlyphString.setGlyph(2 * i, newGlyph);
            }

            smallCr.setSourceRgb(1, 1, 1);
            smallCr.paint();
            smallCr.setSourceRgb(0, 0, 0);

            for (let j = 0; j < 4; j++) {
                for (let i = 0; i < 4; i++) {
                    const g = smallGlyphString.getGlyph(2 * i);
                    const geom = g.getGeometry();
                    const newGlyph = new Pango.GlyphInfo({
                        glyph: g.getGlyph(),
                        geometry: new Pango.GlyphGeometry({
                            width: geom.getWidth(),
                            xOffset: Math.round((i * PANGO_SCALE) / 4),
                            yOffset: Math.round((j * PANGO_SCALE) / 4),
                        }),
                        attr: g.getAttr(),
                    });
                    smallGlyphString.setGlyph(2 * i, newGlyph);
                }

                smallCr.moveTo(0, j * smallLogical.getHeight());
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
                <x.Shortcut trigger="<Control>plus" onActivate={zoomIn} />
                <x.Shortcut trigger="<Control>minus" onActivate={zoomOut} />
            </GtkShortcutController>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkBox cssClasses={["linked"]}>
                            <GtkToggleButton label="Text" active={mode === "text"} onToggled={() => setMode("text")} />
                            <GtkToggleButton label="Grid" active={mode === "grid"} onToggled={() => setMode("grid")} />
                        </GtkBox>
                    </x.Slot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                <GtkGrid halign={Gtk.Align.CENTER} marginTop={10} marginBottom={10} rowSpacing={10} columnSpacing={10}>
                    <x.GridChild column={1} row={0}>
                        <GtkLabel label="Text" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
                    </x.GridChild>
                    <x.GridChild column={2} row={0}>
                        <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} />
                    </x.GridChild>
                    <x.GridChild column={1} row={1}>
                        <GtkLabel label="Font" xalign={1} marginStart={10} cssClasses={["dim-label"]} />
                    </x.GridChild>
                    <x.GridChild column={2} row={1}>
                        <GtkFontDialogButton fontDesc={fontDesc} onFontDescChanged={setFontDesc} />
                    </x.GridChild>
                    <x.GridChild column={3} row={0}>
                        <GtkCheckButton
                            label="Show _Pixels"
                            useUnderline
                            active={overlays.showPixels}
                            onToggled={(btn) => setOverlays((o) => ({ ...o, showPixels: btn.getActive() }))}
                        />
                    </x.GridChild>
                    <x.GridChild column={3} row={1}>
                        <GtkCheckButton
                            label="Show _Outline"
                            useUnderline
                            active={overlays.showOutlines}
                            onToggled={(btn) => setOverlays((o) => ({ ...o, showOutlines: btn.getActive() }))}
                        />
                    </x.GridChild>
                    <x.GridChild column={4} row={0} columnSpan={2}>
                        <GtkBox spacing={6}>
                            <GtkLabel label="_Hinting" useUnderline cssClasses={["dim-label"]} />
                            <GtkDropDown
                                valign={Gtk.Align.CENTER}
                                selectedId={hintStyleOptions.find((o) => o.value === hintStyle)?.id}
                                onSelectionChanged={(id) => {
                                    const opt = hintStyleOptions.find((o) => o.id === id);
                                    if (opt) setHintStyle(opt.value);
                                }}
                            >
                                {hintStyleOptions.map((opt) => (
                                    <x.ListItem key={opt.id} id={opt.id} value={opt.label} />
                                ))}
                            </GtkDropDown>
                        </GtkBox>
                    </x.GridChild>
                    <x.GridChild column={4} row={1}>
                        <GtkCheckButton
                            label="_Antialias"
                            useUnderline
                            active={antialias}
                            onToggled={(btn) => setAntialias(btn.getActive())}
                        />
                    </x.GridChild>
                    <x.GridChild column={5} row={1}>
                        <GtkCheckButton
                            label="Hint _Metrics"
                            useUnderline
                            active={hintMetrics}
                            onToggled={(btn) => setHintMetrics(btn.getActive())}
                        />
                    </x.GridChild>
                    <x.GridChild column={6} row={0}>
                        <GtkCheckButton
                            label="Show _Extents"
                            useUnderline
                            active={overlays.showExtents}
                            onToggled={(btn) => setOverlays((o) => ({ ...o, showExtents: btn.getActive() }))}
                        />
                    </x.GridChild>
                    <x.GridChild column={6} row={1}>
                        <GtkCheckButton
                            label="Show _Grid"
                            useUnderline
                            active={overlays.showGrid}
                            onToggled={(btn) => setOverlays((o) => ({ ...o, showGrid: btn.getActive() }))}
                        />
                    </x.GridChild>
                    <x.GridChild column={7} row={0}>
                        <GtkButton
                            iconName="list-add-symbolic"
                            onClicked={zoomIn}
                            sensitive={scale < 32}
                            cssClasses={["circular"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Zoom in"
                        />
                    </x.GridChild>
                    <x.GridChild column={7} row={1}>
                        <GtkButton
                            iconName="list-remove-symbolic"
                            onClicked={zoomOut}
                            sensitive={scale > 1}
                            cssClasses={["circular"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Zoom out"
                        />
                    </x.GridChild>
                    <x.GridChild column={8} row={0}>
                        <GtkLabel label="" hexpand />
                    </x.GridChild>
                </GtkGrid>

                <GtkSeparator />
                <GtkScrolledWindow hexpand vexpand>
                    <GtkDrawingArea
                        onDraw={drawFunc}
                        vexpand
                        hexpand
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
    description: "Explore font rendering options: hinting, antialiasing, and subpixel rendering",
    keywords: ["font", "rendering", "hinting", "antialiasing", "subpixel", "cairo", "pango", "text", "typography"],
    component: FontRenderingDemo,
    sourceCode,
    defaultWidth: 1024,
    defaultHeight: 768,
};

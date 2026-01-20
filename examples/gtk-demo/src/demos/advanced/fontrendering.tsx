import { Antialias, type Context, FontOptions, HintMetrics, HintStyle } from "@gtkx/ffi/cairo";
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
    GtkLabel,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fontrendering.tsx?raw";

const PANGO_SCALE = 1024;
const DEFAULT_TEXT = "Handgloves";

type Mode = "text" | "glyphs";

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
    const [hintStyle, setHintStyle] = useState<HintStyle>(HintStyle.SLIGHT);
    const [antialias, setAntialias] = useState(true);
    const [hintMetrics, setHintMetrics] = useState(true);
    const [scale, setScale] = useState(7);

    const [overlays, setOverlays] = useState<OverlayState>({
        showPixels: true,
        showOutlines: false,
        showExtents: false,
        showGrid: true,
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
        (_area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).paint();

            const fontOptions = FontOptions.create();
            fontOptions
                .setHintStyle(hintStyle)
                .setAntialias(antialias ? Antialias.GRAY : Antialias.NONE)
                .setHintMetrics(hintMetrics ? HintMetrics.ON : HintMetrics.OFF);

            cr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(cr);
            PangoCairo.contextSetFontOptions(context, fontOptions);

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

            cr.save();

            cr.setSourceRgba(0, 0, 0, pixelAlpha);
            cr.translate(10, 10);
            PangoCairo.showLayout(cr, layout);

            if (overlays.showOutlines || outlineAlpha > 0) {
                PangoCairo.layoutPath(cr, layout);
            }

            cr.restore();

            cr.save();
            cr.scale(scale, scale);

            const scaledWidth = width / scale;
            const scaledHeight = height / scale;
            const offsetX = Math.max(0, (scaledWidth - surfaceWidth) / 2);
            const offsetY = Math.max(0, (scaledHeight - surfaceHeight) / 2);

            cr.setSourceRgb(1, 1, 1);
            cr.rectangle(offsetX, offsetY, surfaceWidth, surfaceHeight);
            cr.fill();

            cr.translate(offsetX, offsetY);

            cr.setSourceRgba(0, 0, 0, pixelAlpha);
            cr.translate(10, 10);
            PangoCairo.showLayout(cr, layout);

            if (overlays.showGrid) {
                cr.setSourceRgba(0.2, 0, 0, 0.2);
                cr.setLineWidth(1 / scale);
                for (let i = 0; i <= surfaceHeight; i++) {
                    cr.moveTo(-10, i - 10);
                    cr.lineTo(surfaceWidth - 10, i - 10);
                }
                for (let i = 0; i <= surfaceWidth; i++) {
                    cr.moveTo(i - 10, -10);
                    cr.lineTo(i - 10, surfaceHeight - 10);
                }
                cr.stroke();
            }

            if (overlays.showExtents) {
                cr.setLineWidth(1 / scale);

                cr.setSourceRgb(0, 0, 1);
                cr.rectangle(
                    logicalRect.getX() / PANGO_SCALE,
                    logicalRect.getY() / PANGO_SCALE,
                    logicalRect.getWidth() / PANGO_SCALE,
                    logicalRect.getHeight() / PANGO_SCALE,
                );
                cr.stroke();

                cr.moveTo(logicalRect.getX() / PANGO_SCALE, baseline / PANGO_SCALE);
                cr.lineTo((logicalRect.getX() + logicalRect.getWidth()) / PANGO_SCALE, baseline / PANGO_SCALE);
                cr.stroke();

                cr.setSourceRgb(1, 0, 0);
                cr.rectangle(inkPixel.x, inkPixel.y, inkPixel.width, inkPixel.height);
                cr.stroke();
            }

            if (outlineAlpha > 0) {
                cr.setSourceRgba(0, 0, 0, outlineAlpha);
                cr.setLineWidth(1 / scale);
                PangoCairo.layoutPath(cr, layout);
                cr.stroke();
            }

            cr.restore();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, scale, overlays, pixelAlpha, outlineAlpha],
    );

    const drawGlyphsMode = useCallback(
        (_area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).paint();

            const fontOptions = FontOptions.create();
            fontOptions
                .setHintStyle(hintStyle)
                .setAntialias(antialias ? Antialias.GRAY : Antialias.NONE)
                .setHintMetrics(hintMetrics ? HintMetrics.ON : HintMetrics.OFF);

            cr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(cr);
            PangoCairo.contextSetFontOptions(context, fontOptions);

            let ch = text.length > 0 ? text[0] : "a";

            const ZWNJ = "\u200C";
            const glyphText = `${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`;

            const layout = new Pango.Layout(context);
            layout.setFontDescription(fontDesc);
            layout.setText(glyphText, -1);

            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);

            const iter = layout.getIter();
            if (!iter) return;

            const runPtr = iter.getRun();
            if (!runPtr) return;

            const glyphItem = new Pango.GlyphItem();
            (glyphItem as { handle: unknown }).handle = runPtr;

            const glyphString = glyphItem.getGlyphs();

            if (glyphString.getNumGlyphs() < 8) {
                ch = "a";
                layout.setText(`${ch}${ZWNJ}${ch}${ZWNJ}${ch}${ZWNJ}${ch}`, -1);
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

            cr.save();
            cr.scale(scale, scale);

            const scaledWidth = width / scale;
            const scaledHeight = height / scale;
            const offsetX = Math.max(0, (scaledWidth - surfaceWidth) / 2);
            const offsetY = Math.max(0, (scaledHeight - surfaceHeight) / 2);

            cr.setSourceRgb(1, 1, 1);
            cr.rectangle(offsetX, offsetY, surfaceWidth, surfaceHeight);
            cr.fill();

            cr.translate(offsetX, offsetY);
            cr.setSourceRgb(0, 0, 0);

            for (let j = 0; j < 4; j++) {
                for (let i = 0; i < 4; i++) {
                    const g = glyphString.getGlyph(2 * i);
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
                    glyphString.setGlyph(2 * i, newGlyph);
                }

                cr.moveTo(0, j * logicalRect.getHeight());
                PangoCairo.showLayout(cr, layout);
            }

            if (overlays.showGrid) {
                cr.setSourceRgba(0.2, 0, 0, 0.2);
                cr.setLineWidth(1 / scale);
                for (let i = 0; i <= surfaceHeight; i++) {
                    cr.moveTo(0, i);
                    cr.lineTo(surfaceWidth, i);
                }
                for (let i = 0; i <= surfaceWidth; i++) {
                    cr.moveTo(i, 0);
                    cr.lineTo(i, surfaceHeight);
                }
                cr.stroke();
            }

            cr.restore();

            iter.free();
        },
        [fontDesc, text, hintStyle, antialias, hintMetrics, scale, overlays.showGrid],
    );

    const drawFunc = mode === "text" ? drawTextMode : drawGlyphsMode;

    const zoomIn = useCallback(() => setScale((s) => Math.min(32, s + 1)), []);
    const zoomOut = useCallback(() => setScale((s) => Math.max(1, s - 1)), []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkBox spacing={12} marginStart={12} marginEnd={12} marginTop={12}>
                <GtkBox cssClasses={["linked"]}>
                    <GtkToggleButton label="Text" active={mode === "text"} onToggled={() => setMode("text")} />
                    <GtkToggleButton label="Glyphs" active={mode === "glyphs"} onToggled={() => setMode("glyphs")} />
                </GtkBox>
                <GtkBox spacing={6}>
                    <GtkButton
                        iconName="zoom-out-symbolic"
                        onClicked={zoomOut}
                        sensitive={scale > 1}
                        cssClasses={["circular"]}
                    />
                    <GtkLabel label={`${scale}x`} />
                    <GtkButton
                        iconName="zoom-in-symbolic"
                        onClicked={zoomIn}
                        sensitive={scale < 32}
                        cssClasses={["circular"]}
                    />
                </GtkBox>
            </GtkBox>

            <GtkGrid columnSpacing={12} rowSpacing={6} marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
                <x.GridChild column={0} row={0}>
                    <GtkLabel label="Text:" halign={Gtk.Align.END} />
                </x.GridChild>
                <x.GridChild column={1} row={0}>
                    <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} hexpand />
                </x.GridChild>
                <x.GridChild column={2} row={0}>
                    <GtkLabel label="Font:" halign={Gtk.Align.END} />
                </x.GridChild>
                <x.GridChild column={3} row={0}>
                    <GtkFontDialogButton fontDesc={fontDesc} onFontDescChanged={setFontDesc} hexpand />
                </x.GridChild>
                <x.GridChild column={0} row={1}>
                    <GtkLabel label="Hint Style:" halign={Gtk.Align.END} />
                </x.GridChild>
                <x.GridChild column={1} row={1}>
                    <GtkDropDown
                        selectedId={hintStyleOptions.find((o) => o.value === hintStyle)?.id}
                        onSelectionChanged={(id) => {
                            const opt = hintStyleOptions.find((o) => o.id === id);
                            if (opt) setHintStyle(opt.value);
                        }}
                    >
                        {hintStyleOptions.map((opt) => (
                            <x.SimpleListItem key={opt.id} id={opt.id} value={opt.label} />
                        ))}
                    </GtkDropDown>
                </x.GridChild>
                <x.GridChild column={2} row={1}>
                    <GtkCheckButton
                        label="Antialias"
                        active={antialias}
                        onToggled={(btn) => setAntialias(btn.getActive())}
                    />
                </x.GridChild>
                <x.GridChild column={3} row={1}>
                    <GtkCheckButton
                        label="Hint Metrics"
                        active={hintMetrics}
                        onToggled={(btn) => setHintMetrics(btn.getActive())}
                    />
                </x.GridChild>
                <x.GridChild column={0} row={2}>
                    <GtkCheckButton
                        label="Show Pixels"
                        active={overlays.showPixels}
                        onToggled={(btn) => setOverlays((o) => ({ ...o, showPixels: btn.getActive() }))}
                    />
                </x.GridChild>
                <x.GridChild column={1} row={2}>
                    <GtkCheckButton
                        label="Show Outlines"
                        active={overlays.showOutlines}
                        onToggled={(btn) => setOverlays((o) => ({ ...o, showOutlines: btn.getActive() }))}
                    />
                </x.GridChild>
                <x.GridChild column={2} row={2}>
                    <GtkCheckButton
                        label="Show Extents"
                        active={overlays.showExtents}
                        onToggled={(btn) => setOverlays((o) => ({ ...o, showExtents: btn.getActive() }))}
                    />
                </x.GridChild>
                <x.GridChild column={3} row={2}>
                    <GtkCheckButton
                        label="Show Grid"
                        active={overlays.showGrid}
                        onToggled={(btn) => setOverlays((o) => ({ ...o, showGrid: btn.getActive() }))}
                    />
                </x.GridChild>
            </GtkGrid>

            <GtkDrawingArea onDraw={drawFunc} vexpand hexpand cssClasses={["view"]} />
        </GtkBox>
    );
};

export const fontRenderingDemo: Demo = {
    id: "fontrendering",
    title: "Pango/Font Rendering",
    description: "Explore font rendering options: hinting, antialiasing, and subpixel rendering",
    keywords: ["font", "rendering", "hinting", "antialiasing", "subpixel", "cairo", "pango", "text", "typography"],
    component: FontRenderingDemo,
    sourceCode,
};

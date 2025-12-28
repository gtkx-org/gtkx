import * as Cairo from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkDrawingArea, GtkDropDown, GtkFrame, GtkLabel, GtkScale, SimpleListItem } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fontrendering.tsx?raw";

const SAMPLE_TEXT = "Handgloves";
const SAMPLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

interface FontRenderingOptions {
    hintStyle: Cairo.HintStyle;
    antialias: Cairo.Antialias;
    hintMetrics: Cairo.HintMetrics;
    subpixelOrder: Cairo.SubpixelOrder;
}

const hintStyleLabels: Record<Cairo.HintStyle, string> = {
    [Cairo.HintStyle.DEFAULT]: "Default",
    [Cairo.HintStyle.NONE]: "None",
    [Cairo.HintStyle.SLIGHT]: "Slight",
    [Cairo.HintStyle.MEDIUM]: "Medium",
    [Cairo.HintStyle.FULL]: "Full",
};

const antialiasLabels: Record<Cairo.Antialias, string> = {
    [Cairo.Antialias.DEFAULT]: "Default",
    [Cairo.Antialias.NONE]: "None",
    [Cairo.Antialias.GRAY]: "Gray",
    [Cairo.Antialias.SUBPIXEL]: "Subpixel",
    [Cairo.Antialias.FAST]: "Fast",
    [Cairo.Antialias.GOOD]: "Good",
    [Cairo.Antialias.BEST]: "Best",
};

const hintMetricsLabels: Record<Cairo.HintMetrics, string> = {
    [Cairo.HintMetrics.DEFAULT]: "Default",
    [Cairo.HintMetrics.OFF]: "Off",
    [Cairo.HintMetrics.ON]: "On",
};

const subpixelOrderLabels: Record<Cairo.SubpixelOrder, string> = {
    [Cairo.SubpixelOrder.DEFAULT]: "Default",
    [Cairo.SubpixelOrder.RGB]: "RGB",
    [Cairo.SubpixelOrder.BGR]: "BGR",
    [Cairo.SubpixelOrder.VRGB]: "Vertical RGB",
    [Cairo.SubpixelOrder.VBGR]: "Vertical BGR",
};

/**
 * Renders text with specific font options and optional magnification.
 */
const FontRenderPreview = ({
    options,
    fontSize,
    scale,
    showGrid,
    text,
}: {
    options: FontRenderingOptions;
    fontSize: number;
    scale: number;
    showGrid: boolean;
    text: string;
}) => {
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);

    const drawFunc = useCallback(
        (_area: Gtk.DrawingArea, cr: Cairo.Context, width: number, height: number) => {
            // Clear background
            Cairo.setSourceRgb(cr, 1, 1, 1);
            Cairo.paint(cr);

            // Draw pixel grid if enabled and scale > 1
            if (showGrid && scale > 1) {
                Cairo.setSourceRgba(cr, 0.8, 0.8, 0.8, 0.5);
                Cairo.setLineWidth(cr, 0.5);
                const gridStep = scale;
                for (let x = 0; x <= width; x += gridStep) {
                    Cairo.moveTo(cr, x, 0);
                    Cairo.lineTo(cr, x, height);
                }
                for (let y = 0; y <= height; y += gridStep) {
                    Cairo.moveTo(cr, 0, y);
                    Cairo.lineTo(cr, width, y);
                }
                Cairo.stroke(cr);
            }

            // Create font options
            const fontOptions = Cairo.fontOptionsCreate();
            Cairo.fontOptionsSetHintStyle(fontOptions, options.hintStyle);
            Cairo.fontOptionsSetAntialias(fontOptions, options.antialias);
            Cairo.fontOptionsSetHintMetrics(fontOptions, options.hintMetrics);
            Cairo.fontOptionsSetSubpixelOrder(fontOptions, options.subpixelOrder);

            // Apply scale transformation
            Cairo.save(cr);
            Cairo.scale(cr, scale, scale);

            // Set font options on context
            Cairo.setFontOptions(cr, fontOptions);

            // Create Pango layout with the font options
            const context = PangoCairo.createContext(cr);
            PangoCairo.contextSetFontOptions(context, fontOptions);

            const layout = new Pango.Layout(context);
            const fontDesc = Pango.FontDescription.fromString(`Sans ${fontSize}px`);
            layout.setFontDescription(fontDesc);
            layout.setText(text, -1);

            // Position text
            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);
            const scaledWidth = width / scale;
            const scaledHeight = height / scale;
            const x = (scaledWidth - logicalRect.width) / 2;
            const y = (scaledHeight - logicalRect.height) / 2;

            Cairo.translate(cr, x, y);

            // Draw text
            Cairo.setSourceRgb(cr, 0, 0, 0);
            PangoCairo.showLayout(cr, layout);

            Cairo.restore(cr);
        },
        [options, fontSize, scale, showGrid, text],
    );

    useEffect(() => {
        if (drawingAreaRef.current) {
            drawingAreaRef.current.setDrawFunc(drawFunc);
        }
    }, [drawFunc]);

    useEffect(() => {
        drawingAreaRef.current?.queueDraw();
    }, []);

    return <GtkDrawingArea ref={drawingAreaRef} contentWidth={400} contentHeight={120} cssClasses={["card"]} hexpand />;
};

/**
 * Side-by-side comparison of two font rendering configurations.
 */
const ComparisonView = ({
    leftOptions,
    rightOptions,
    leftLabel,
    rightLabel,
    fontSize,
    scale,
}: {
    leftOptions: FontRenderingOptions;
    rightOptions: FontRenderingOptions;
    leftLabel: string;
    rightLabel: string;
    fontSize: number;
    scale: number;
}) => {
    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16} homogeneous>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label={leftLabel} cssClasses={["heading"]} />
                <FontRenderPreview
                    options={leftOptions}
                    fontSize={fontSize}
                    scale={scale}
                    showGrid={scale > 1}
                    text={SAMPLE_TEXT}
                />
            </GtkBox>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label={rightLabel} cssClasses={["heading"]} />
                <FontRenderPreview
                    options={rightOptions}
                    fontSize={fontSize}
                    scale={scale}
                    showGrid={scale > 1}
                    text={SAMPLE_TEXT}
                />
            </GtkBox>
        </GtkBox>
    );
};

const FontRenderingDemo = () => {
    const [hintStyle, setHintStyle] = useState<Cairo.HintStyle>(Cairo.HintStyle.DEFAULT);
    const [antialias, setAntialias] = useState<Cairo.Antialias>(Cairo.Antialias.DEFAULT);
    const [hintMetrics, setHintMetrics] = useState<Cairo.HintMetrics>(Cairo.HintMetrics.DEFAULT);
    const [subpixelOrder, setSubpixelOrder] = useState<Cairo.SubpixelOrder>(Cairo.SubpixelOrder.DEFAULT);
    const [fontSize, setFontSize] = useState(24);
    const [scale, setScale] = useState(4);

    const fontSizeAdjustment = useMemo(() => new Gtk.Adjustment(24, 8, 72, 1, 4, 0), []);
    const scaleAdjustment = useMemo(() => new Gtk.Adjustment(4, 1, 16, 1, 2, 0), []);

    const options: FontRenderingOptions = {
        hintStyle,
        antialias,
        hintMetrics,
        subpixelOrder,
    };

    // Preset comparisons
    const noHintingOptions: FontRenderingOptions = {
        hintStyle: Cairo.HintStyle.NONE,
        antialias: Cairo.Antialias.GRAY,
        hintMetrics: Cairo.HintMetrics.OFF,
        subpixelOrder: Cairo.SubpixelOrder.DEFAULT,
    };

    const fullHintingOptions: FontRenderingOptions = {
        hintStyle: Cairo.HintStyle.FULL,
        antialias: Cairo.Antialias.GRAY,
        hintMetrics: Cairo.HintMetrics.ON,
        subpixelOrder: Cairo.SubpixelOrder.DEFAULT,
    };

    const grayAAOptions: FontRenderingOptions = {
        hintStyle: Cairo.HintStyle.SLIGHT,
        antialias: Cairo.Antialias.GRAY,
        hintMetrics: Cairo.HintMetrics.ON,
        subpixelOrder: Cairo.SubpixelOrder.DEFAULT,
    };

    const subpixelAAOptions: FontRenderingOptions = {
        hintStyle: Cairo.HintStyle.SLIGHT,
        antialias: Cairo.Antialias.SUBPIXEL,
        hintMetrics: Cairo.HintMetrics.ON,
        subpixelOrder: Cairo.SubpixelOrder.RGB,
    };

    const hintStyleOptions = Object.entries(hintStyleLabels) as [string, string][];
    const antialiasOptions = Object.entries(antialiasLabels) as [string, string][];
    const hintMetricsOptions = Object.entries(hintMetricsLabels) as [string, string][];
    const subpixelOrderOptions = Object.entries(subpixelOrderLabels) as [string, string][];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Font Rendering" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Font rendering involves several options that affect how glyphs are rasterized. Hinting adjusts glyph outlines to align with the pixel grid, while antialiasing smooths edges. These settings can significantly impact text readability."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {/* Main Preview */}
            <GtkFrame label="Preview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <FontRenderPreview
                        options={options}
                        fontSize={fontSize}
                        scale={scale}
                        showGrid={scale > 1}
                        text={SAMPLE_TEXT}
                    />
                    <FontRenderPreview
                        options={options}
                        fontSize={fontSize}
                        scale={1}
                        showGrid={false}
                        text={SAMPLE_CHARS}
                    />
                </GtkBox>
            </GtkFrame>

            {/* Controls */}
            <GtkFrame label="Font Options">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Hint Style:" widthRequest={120} halign={Gtk.Align.START} />
                        <GtkDropDown
                            selectedId={String(hintStyle)}
                            onSelectionChanged={(id) => setHintStyle(Number(id) as Cairo.HintStyle)}
                            hexpand
                        >
                            {hintStyleOptions.map(([value, label]) => (
                                <SimpleListItem key={value} id={value} value={label} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Antialiasing:" widthRequest={120} halign={Gtk.Align.START} />
                        <GtkDropDown
                            selectedId={String(antialias)}
                            onSelectionChanged={(id) => setAntialias(Number(id) as Cairo.Antialias)}
                            hexpand
                        >
                            {antialiasOptions.map(([value, label]) => (
                                <SimpleListItem key={value} id={value} value={label} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Hint Metrics:" widthRequest={120} halign={Gtk.Align.START} />
                        <GtkDropDown
                            selectedId={String(hintMetrics)}
                            onSelectionChanged={(id) => setHintMetrics(Number(id) as Cairo.HintMetrics)}
                            hexpand
                        >
                            {hintMetricsOptions.map(([value, label]) => (
                                <SimpleListItem key={value} id={value} value={label} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Subpixel Order:" widthRequest={120} halign={Gtk.Align.START} />
                        <GtkDropDown
                            selectedId={String(subpixelOrder)}
                            onSelectionChanged={(id) => setSubpixelOrder(Number(id) as Cairo.SubpixelOrder)}
                            hexpand
                        >
                            {subpixelOrderOptions.map(([value, label]) => (
                                <SimpleListItem key={value} id={value} value={label} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* Size Controls */}
            <GtkFrame label="Display Settings">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Font Size:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkScale
                            orientation={Gtk.Orientation.HORIZONTAL}
                            adjustment={fontSizeAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(s) => setFontSize(Math.round(s.getValue()))}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Magnification:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkScale
                            orientation={Gtk.Orientation.HORIZONTAL}
                            adjustment={scaleAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(s) => setScale(Math.round(s.getValue()))}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* Comparisons */}
            <GtkFrame label="Hinting Comparison">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel
                        label="Compare no hinting vs full hinting. Full hinting aligns glyphs to the pixel grid for sharper edges."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <ComparisonView
                        leftOptions={noHintingOptions}
                        rightOptions={fullHintingOptions}
                        leftLabel="No Hinting"
                        rightLabel="Full Hinting"
                        fontSize={fontSize}
                        scale={scale}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Antialiasing Comparison">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel
                        label="Compare gray antialiasing vs subpixel antialiasing. Subpixel uses RGB components for finer detail on LCD screens."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <ComparisonView
                        leftOptions={grayAAOptions}
                        rightOptions={subpixelAAOptions}
                        leftLabel="Gray Antialiasing"
                        rightLabel="Subpixel Antialiasing"
                        fontSize={fontSize}
                        scale={scale}
                    />
                </GtkBox>
            </GtkFrame>

            {/* Reference */}
            <GtkFrame label="Font Options Reference">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Hint Style" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`None: No hinting, preserves original outline
Slight: Light hinting, improves contrast
Medium: Medium hinting
Full: Full hinting, snaps to pixel grid`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace", "dim-label"]}
                    />

                    <GtkLabel label="Antialiasing" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                    <GtkLabel
                        label={`None: No antialiasing (aliased/jagged edges)
Gray: Grayscale antialiasing
Subpixel: Uses LCD subpixels for finer detail`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace", "dim-label"]}
                    />

                    <GtkLabel label="Hint Metrics" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                    <GtkLabel
                        label={`Off: Don't quantize metrics to pixels
On: Round glyph positions to pixel boundaries`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace", "dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const fontRenderingDemo: Demo = {
    id: "fontrendering",
    title: "Font Rendering",
    description: "Explore font rendering options: hinting, antialiasing, and subpixel rendering",
    keywords: ["font", "rendering", "hinting", "antialiasing", "subpixel", "cairo", "pango", "text", "typography"],
    component: FontRenderingDemo,
    sourceCode,
};

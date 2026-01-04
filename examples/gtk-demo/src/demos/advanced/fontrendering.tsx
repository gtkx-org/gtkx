import { Antialias, type Context, FontOptions, HintMetrics, HintStyle, SubpixelOrder } from "@gtkx/ffi/cairo";
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
    hintStyle: HintStyle;
    antialias: Antialias;
    hintMetrics: HintMetrics;
    subpixelOrder: SubpixelOrder;
}

const hintStyleLabels: Record<HintStyle, string> = {
    [HintStyle.DEFAULT]: "Default",
    [HintStyle.NONE]: "None",
    [HintStyle.SLIGHT]: "Slight",
    [HintStyle.MEDIUM]: "Medium",
    [HintStyle.FULL]: "Full",
};

const antialiasLabels: Record<Antialias, string> = {
    [Antialias.DEFAULT]: "Default",
    [Antialias.NONE]: "None",
    [Antialias.GRAY]: "Gray",
    [Antialias.SUBPIXEL]: "Subpixel",
    [Antialias.FAST]: "Fast",
    [Antialias.GOOD]: "Good",
    [Antialias.BEST]: "Best",
};

const hintMetricsLabels: Record<HintMetrics, string> = {
    [HintMetrics.DEFAULT]: "Default",
    [HintMetrics.OFF]: "Off",
    [HintMetrics.ON]: "On",
};

const subpixelOrderLabels: Record<SubpixelOrder, string> = {
    [SubpixelOrder.DEFAULT]: "Default",
    [SubpixelOrder.RGB]: "RGB",
    [SubpixelOrder.BGR]: "BGR",
    [SubpixelOrder.VRGB]: "Vertical RGB",
    [SubpixelOrder.VBGR]: "Vertical BGR",
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
        (_area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).paint();

            if (showGrid && scale > 1) {
                cr.setSourceRgba(0.8, 0.8, 0.8, 0.5).setLineWidth(0.5);
                const gridStep = scale;
                for (let x = 0; x <= width; x += gridStep) {
                    cr.moveTo(x, 0).lineTo(x, height);
                }
                for (let y = 0; y <= height; y += gridStep) {
                    cr.moveTo(0, y).lineTo(width, y);
                }
                cr.stroke();
            }

            const fontOptions = FontOptions.create();
            fontOptions
                .setHintStyle(options.hintStyle)
                .setAntialias(options.antialias)
                .setHintMetrics(options.hintMetrics)
                .setSubpixelOrder(options.subpixelOrder);

            cr.save().scale(scale, scale);

            cr.setFontOptions(fontOptions);

            const context = PangoCairo.createContext(cr);
            PangoCairo.contextSetFontOptions(context, fontOptions);

            const layout = new Pango.Layout(context);
            const fontDesc = Pango.FontDescription.fromString(`Sans ${fontSize}px`);
            layout.setFontDescription(fontDesc);
            layout.setText(text, -1);

            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);
            const scaledWidth = width / scale;
            const scaledHeight = height / scale;
            const x = (scaledWidth - logicalRect.width) / 2;
            const y = (scaledHeight - logicalRect.height) / 2;

            cr.translate(x, y);

            cr.setSourceRgb(0, 0, 0);
            PangoCairo.showLayout(cr, layout);

            cr.restore();
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
    const [hintStyle, setHintStyle] = useState<HintStyle>(HintStyle.DEFAULT);
    const [antialias, setAntialias] = useState<Antialias>(Antialias.DEFAULT);
    const [hintMetrics, setHintMetrics] = useState<HintMetrics>(HintMetrics.DEFAULT);
    const [subpixelOrder, setSubpixelOrder] = useState<SubpixelOrder>(SubpixelOrder.DEFAULT);
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

    const noHintingOptions: FontRenderingOptions = {
        hintStyle: HintStyle.NONE,
        antialias: Antialias.GRAY,
        hintMetrics: HintMetrics.OFF,
        subpixelOrder: SubpixelOrder.DEFAULT,
    };

    const fullHintingOptions: FontRenderingOptions = {
        hintStyle: HintStyle.FULL,
        antialias: Antialias.GRAY,
        hintMetrics: HintMetrics.ON,
        subpixelOrder: SubpixelOrder.DEFAULT,
    };

    const grayAAOptions: FontRenderingOptions = {
        hintStyle: HintStyle.SLIGHT,
        antialias: Antialias.GRAY,
        hintMetrics: HintMetrics.ON,
        subpixelOrder: SubpixelOrder.DEFAULT,
    };

    const subpixelAAOptions: FontRenderingOptions = {
        hintStyle: HintStyle.SLIGHT,
        antialias: Antialias.SUBPIXEL,
        hintMetrics: HintMetrics.ON,
        subpixelOrder: SubpixelOrder.RGB,
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
                            onSelectionChanged={(id) => setHintStyle(Number(id) as HintStyle)}
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
                            onSelectionChanged={(id) => setAntialias(Number(id) as Antialias)}
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
                            onSelectionChanged={(id) => setHintMetrics(Number(id) as HintMetrics)}
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
                            onSelectionChanged={(id) => setSubpixelOrder(Number(id) as SubpixelOrder)}
                            hexpand
                        >
                            {subpixelOrderOptions.map(([value, label]) => (
                                <SimpleListItem key={value} id={value} value={label} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

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

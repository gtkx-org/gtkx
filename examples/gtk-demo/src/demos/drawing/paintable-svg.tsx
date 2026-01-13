import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkPicture, GtkScale } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable-svg.tsx?raw";

function createMemoryTexture(
    width: number,
    height: number,
    format: Gdk.MemoryFormat,
    pixelData: number[],
    stride: number,
): Gdk.MemoryTexture {
    const bytes = new GLib.Bytes(pixelData.length, pixelData);
    return new Gdk.MemoryTexture(width, height, format, bytes, stride);
}

const SVG_TEMPLATES = {
    circle: (color: string, strokeWidth: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="40" fill="${color}" stroke="#333" stroke-width="${strokeWidth}"/>
</svg>`,

    star: (color: string, points: number) => {
        const outerR = 45;
        const innerR = 20;
        let path = "";
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = 50 + Math.cos(angle) * r;
            const y = 50 + Math.sin(angle) * r;
            path += `${(i === 0 ? "M" : "L") + x.toFixed(2)},${y.toFixed(2)}`;
        }
        path += "Z";
        return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
 <path d="${path}" fill="${color}" stroke="#333" stroke-width="2"/>
</svg>`;
    },

    gradient: (startColor: string, endColor: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
 <defs>
 <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
 <stop offset="0%" style="stop-color:${startColor}"/>
 <stop offset="100%" style="stop-color:${endColor}"/>
 </linearGradient>
 </defs>
 <rect x="5" y="5" width="90" height="90" rx="10" fill="url(#grad)"/>
</svg>`,

    pattern: (color1: string, color2: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
 <defs>
 <pattern id="checkers" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
 <rect x="0" y="0" width="10" height="10" fill="${color1}"/>
 <rect x="10" y="10" width="10" height="10" fill="${color1}"/>
 <rect x="10" y="0" width="10" height="10" fill="${color2}"/>
 <rect x="0" y="10" width="10" height="10" fill="${color2}"/>
 </pattern>
 </defs>
 <rect x="0" y="0" width="100" height="100" fill="url(#checkers)"/>
</svg>`,

    logo: () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
 <rect x="10" y="10" width="80" height="80" rx="15" fill="#3584e4"/>
 <text x="50" y="60" text-anchor="middle" font-size="24" font-family="sans-serif" fill="white">GTK</text>
 <circle cx="75" cy="25" r="8" fill="#f5c211"/>
</svg>`,
};

const COLORS = ["#3584e4", "#33d17a", "#f6d32d", "#ff7800", "#e01b24", "#9141ac"];

const PaintableSvgDemo = () => {
    const [selectedShape, setSelectedShape] = useState<keyof typeof SVG_TEMPLATES>("circle");
    const [colorIndex, setColorIndex] = useState(0);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [starPoints, setStarPoints] = useState(5);
    const strokeAdjustment = useMemo(() => new Gtk.Adjustment(3, 1, 10, 1, 2, 0), []);
    const starPointsAdjustment = useMemo(() => new Gtk.Adjustment(5, 3, 12, 1, 2, 0), []);

    const color = COLORS[colorIndex] ?? COLORS[0] ?? "#3584e4";
    const nextColor = COLORS[(colorIndex + 1) % COLORS.length] ?? COLORS[1] ?? "#e01b24";

    const svgContent = useMemo(() => {
        switch (selectedShape) {
            case "circle":
                return SVG_TEMPLATES.circle(color, strokeWidth);
            case "star":
                return SVG_TEMPLATES.star(color, starPoints);
            case "gradient":
                return SVG_TEMPLATES.gradient(color, nextColor);
            case "pattern":
                return SVG_TEMPLATES.pattern(color, nextColor);
            case "logo":
                return SVG_TEMPLATES.logo();
            default:
                return SVG_TEMPLATES.circle(color, strokeWidth);
        }
    }, [selectedShape, color, nextColor, strokeWidth, starPoints]);

    const texture = useMemo(() => {
        try {
            const encoder = new TextEncoder();
            const svgBytes = encoder.encode(svgContent);
            const byteArray = Array.from(svgBytes);
            const gBytes = new GLib.Bytes(byteArray.length, byteArray);
            return Gdk.Texture.newFromBytes(gBytes);
        } catch {
            const size = 64;
            const data: number[] = [];
            for (let i = 0; i < size * size; i++) {
                data.push(200, 200, 200, 255);
            }
            return createMemoryTexture(size, size, Gdk.MemoryFormat.R8G8B8A8, data, size * 4);
        }
    }, [svgContent]);

    const cycleColor = () => {
        setColorIndex((prev) => (prev + 1) % COLORS.length);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="SVG Paintable" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="SVG images can be rendered as paintables using GdkTexture. SVG files are resolution-independent and scale smoothly to any size. GTK uses librsvg to render SVG content into textures."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="SVG Rendering">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                paintable={texture}
                                contentFit={Gtk.ContentFit.CONTAIN}
                                widthRequest={100}
                                heightRequest={100}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="100x100" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                paintable={texture}
                                contentFit={Gtk.ContentFit.CONTAIN}
                                widthRequest={200}
                                heightRequest={200}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="200x200" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Shape Selection">
                <GtkBox
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {(Object.keys(SVG_TEMPLATES) as (keyof typeof SVG_TEMPLATES)[]).map((shape) => (
                        <GtkButton
                            key={shape}
                            label={shape.charAt(0).toUpperCase() + shape.slice(1)}
                            onClicked={() => setSelectedShape(shape)}
                            cssClasses={selectedShape === shape ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Shape Options">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Color:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkButton label="Cycle Color" onClicked={cycleColor} />
                        <GtkBox widthRequest={24} heightRequest={24} cssClasses={["card"]} />
                    </GtkBox>

                    {selectedShape === "circle" && (
                        <GtkBox spacing={12}>
                            <GtkLabel label="Stroke Width:" widthRequest={100} halign={Gtk.Align.START} />
                            <GtkScale
                                drawValue
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                adjustment={strokeAdjustment}
                                onValueChanged={(self) => setStrokeWidth(Math.floor(self.getValue()))}
                            />
                        </GtkBox>
                    )}

                    {selectedShape === "star" && (
                        <GtkBox spacing={12}>
                            <GtkLabel label="Star Points:" widthRequest={100} halign={Gtk.Align.START} />
                            <GtkScale
                                drawValue
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                adjustment={starPointsAdjustment}
                                onValueChanged={(self) => setStarPoints(Math.floor(self.getValue()))}
                            />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="SVG Features">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`SVG advantages for paintables:
- Resolution independent (vector graphics)
- Small file size for simple graphics
- Supports gradients, patterns, filters
- Perfect for icons and UI elements
- Can be dynamically generated`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const paintableSvgDemo: Demo = {
    id: "paintable-svg",
    title: "SVG Paintable",
    description: "SVG rendering via GdkTexture",
    keywords: ["paintable", "svg", "vector", "scalable", "graphics", "texture", "librsvg"],
    component: PaintableSvgDemo,
    sourceCode,
};

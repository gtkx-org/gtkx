import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkPicture } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable.tsx?raw";

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

const PaintableDemo = () => {
    const [selectedTexture, setSelectedTexture] = useState<"checkerboard" | "gradient" | "noise">("checkerboard");

    const checkerboardTexture = useMemo(() => {
        const size = 64;
        const checkSize = 8;
        const data: number[] = [];

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const isWhite = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
                const value = isWhite ? 255 : 100;
                data.push(value, value, value, 255); // RGBA
            }
        }

        return createMemoryTexture(size, size, Gdk.MemoryFormat.R8G8B8A8, data, size * 4);
    }, []);

    const gradientTexture = useMemo(() => {
        const width = 256;
        const height = 64;
        const data: number[] = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const t = x / width;

                const hue = t * 360;
                const { r, g, b } = hslToRgb(hue, 0.8, 0.5);

                data.push(r, g, b, 255);
            }
        }

        return createMemoryTexture(width, height, Gdk.MemoryFormat.R8G8B8A8, data, width * 4);
    }, []);

    const noiseTexture = useMemo(() => {
        const size = 128;
        const data: number[] = [];

        let seed = 12345;
        const random = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = Math.floor(random() * 255);
                data.push(value, value, value, 255);
            }
        }

        return createMemoryTexture(size, size, Gdk.MemoryFormat.R8G8B8A8, data, size * 4);
    }, []);

    const textures = {
        checkerboard: checkerboardTexture,
        gradient: gradientTexture,
        noise: noiseTexture,
    };

    const currentTexture = textures[selectedTexture];

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Paintable" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GdkPaintable is an interface for content that can be painted anywhere at any size. Textures, icons, and media streams all implement this interface. GdkTexture is an immutable paintable that holds pixel data."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="GdkMemoryTexture - Programmatic Textures">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Create textures from raw pixel data using GdkMemoryTexture"
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label="Checkerboard"
                            onClicked={() => setSelectedTexture("checkerboard")}
                            cssClasses={selectedTexture === "checkerboard" ? ["suggested-action"] : []}
                        />
                        <GtkButton
                            label="Gradient"
                            onClicked={() => setSelectedTexture("gradient")}
                            cssClasses={selectedTexture === "gradient" ? ["suggested-action"] : []}
                        />
                        <GtkButton
                            label="Noise"
                            onClicked={() => setSelectedTexture("noise")}
                            cssClasses={selectedTexture === "noise" ? ["suggested-action"] : []}
                        />
                    </GtkBox>

                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                paintable={currentTexture}
                                contentFit={Gtk.ContentFit.CONTAIN}
                                widthRequest={200}
                                heightRequest={200}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="Contain" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                paintable={currentTexture}
                                contentFit={Gtk.ContentFit.COVER}
                                widthRequest={200}
                                heightRequest={200}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="Cover" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>

                    <GtkLabel
                        label={`Texture: ${currentTexture.getWidth()}x${currentTexture.getHeight()} pixels`}
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Paintable Types">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Common GdkPaintable implementations:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label={`GdkTexture - Immutable pixel data (PNG, JPEG, etc.)
GdkMemoryTexture - Create textures from raw bytes
GtkIconPaintable - Icons from icon theme
GtkMediaStream - Video/audio with paintable frames
GskRenderNode - Custom rendering via GSK`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="GtkPicture Properties">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`contentFit options:
 FILL - Stretch to fill, ignoring aspect ratio
 CONTAIN - Scale to fit, preserving aspect ratio (with letterboxing)
 COVER - Scale to fill, cropping if necessary
 SCALE_DOWN - Like CONTAIN, but never scale up`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h = h / 360;
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

export const paintableDemo: Demo = {
    id: "paintable",
    title: "Paintable/Simple Paintable",
    description: "Custom GdkPaintable implementation with textures",
    keywords: ["paintable", "GdkPaintable", "texture", "GdkTexture", "GdkMemoryTexture", "image", "picture"],
    component: PaintableDemo,
    sourceCode,
};

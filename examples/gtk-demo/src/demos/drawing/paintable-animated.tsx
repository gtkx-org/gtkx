import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkPicture, GtkScale, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable-animated.tsx?raw";

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

function createAnimatedFrame(
    width: number,
    height: number,
    time: number,
    animationType: "plasma" | "wave" | "spiral",
): Gdk.MemoryTexture {
    const data: number[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const nx = x / width;
            const ny = y / height;

            let r: number, g: number, b: number;

            switch (animationType) {
                case "plasma": {
                    const v1 = Math.sin(nx * 10 + time);
                    const v2 = Math.sin(ny * 10 + time);
                    const v3 = Math.sin((nx + ny) * 10 + time);
                    const v4 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 20 + time);
                    const v = (v1 + v2 + v3 + v4) / 4;

                    r = Math.floor(((Math.sin(v * Math.PI) + 1) / 2) * 255);
                    g = Math.floor(((Math.sin(v * Math.PI + 2) + 1) / 2) * 255);
                    b = Math.floor(((Math.sin(v * Math.PI + 4) + 1) / 2) * 255);
                    break;
                }
                case "wave": {
                    const wave = Math.sin(nx * 20 + time * 3) * 0.1 + Math.sin(ny * 15 + time * 2) * 0.1;
                    const dist = Math.abs(ny - 0.5 - wave);
                    const intensity = Math.max(0, 1 - dist * 5);

                    r = Math.floor(intensity * 100);
                    g = Math.floor(intensity * 150 + (1 - intensity) * 30);
                    b = Math.floor(intensity * 255 + (1 - intensity) * 50);
                    break;
                }
                case "spiral": {
                    const cx = nx - 0.5;
                    const cy = ny - 0.5;
                    const angle = Math.atan2(cy, cx);
                    const dist = Math.sqrt(cx * cx + cy * cy);
                    const spiral = Math.sin(angle * 5 + dist * 30 - time * 4);

                    const hue = ((angle + Math.PI) / (2 * Math.PI) + time / 10) % 1;
                    const { r: hr, g: hg, b: hb } = hslToRgb(hue * 360, 0.8, 0.4 + spiral * 0.2);
                    r = hr;
                    g = hg;
                    b = hb;
                    break;
                }
            }

            data.push(r, g, b, 255);
        }
    }

    return createMemoryTexture(width, height, Gdk.MemoryFormat.R8G8B8A8, data, width * 4);
}

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

const PaintableAnimatedDemo = () => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [displayTime, setDisplayTime] = useState(0);
    const [speed, setSpeed] = useState(1.0);
    const [animationType, setAnimationType] = useState<"plasma" | "wave" | "spiral">("plasma");
    const [resolution, setResolution] = useState(128);
    const pictureRef = useRef<Gtk.Picture | null>(null);
    const lastFrameTimeRef = useRef<number | null>(null);
    const tickIdRef = useRef<number | null>(null);
    const timeRef = useRef(0);
    const speedRef = useRef(speed);
    const animationTypeRef = useRef(animationType);
    const resolutionRef = useRef(resolution);
    const displayUpdateRef = useRef(0);
    speedRef.current = speed;
    animationTypeRef.current = animationType;
    resolutionRef.current = resolution;

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const picture = pictureRef.current;
        if (!picture) return true;

        const frameTime = frameClock.getFrameTime();
        if (lastFrameTimeRef.current !== null) {
            const delta = (frameTime - lastFrameTimeRef.current) / 1_000_000;
            timeRef.current += delta * speedRef.current;

            const res = resolutionRef.current;
            const texture = createAnimatedFrame(res, res, timeRef.current, animationTypeRef.current);
            picture.setPaintable(texture);

            displayUpdateRef.current += delta;
            if (displayUpdateRef.current >= 0.1) {
                displayUpdateRef.current = 0;
                setDisplayTime(timeRef.current);
            }
        }
        lastFrameTimeRef.current = frameTime;
        return true;
    }, []);

    const startAnimation = useCallback(() => {
        const picture = pictureRef.current;
        if (!picture || tickIdRef.current !== null) return;
        lastFrameTimeRef.current = null;
        tickIdRef.current = picture.addTickCallback(tickCallback);
    }, [tickCallback]);

    const stopAnimation = useCallback(() => {
        const picture = pictureRef.current;
        if (!picture || tickIdRef.current === null) return;
        picture.removeTickCallback(tickIdRef.current);
        tickIdRef.current = null;
        lastFrameTimeRef.current = null;
    }, []);

    const handlePictureRef = useCallback((picture: Gtk.Picture | null) => {
        if (pictureRef.current && tickIdRef.current !== null) {
            pictureRef.current.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
        pictureRef.current = picture;
        if (picture) {
            const res = resolutionRef.current;
            const texture = createAnimatedFrame(res, res, timeRef.current, animationTypeRef.current);
            picture.setPaintable(texture);
        }
    }, []);

    const handleTogglePlay = useCallback(() => {
        setIsPlaying((prev) => {
            if (prev) {
                stopAnimation();
            } else {
                startAnimation();
            }
            return !prev;
        });
    }, [startAnimation, stopAnimation]);

    const handleReset = useCallback(() => {
        timeRef.current = 0;
        setDisplayTime(0);
        const picture = pictureRef.current;
        if (picture) {
            const res = resolutionRef.current;
            const texture = createAnimatedFrame(res, res, 0, animationTypeRef.current);
            picture.setPaintable(texture);
        }
    }, []);

    useEffect(() => {
        if (isPlaying) {
            startAnimation();
        }
        return stopAnimation;
    }, [isPlaying, startAnimation, stopAnimation]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Animated Paintable" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Paintables can be animated by generating new texture frames over time. This demo creates procedural animations by updating GdkMemoryTexture contents each frame. For video playback, use GtkMediaStream instead."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Animated Texture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkPicture
                        ref={handlePictureRef}
                        contentFit={Gtk.ContentFit.CONTAIN}
                        widthRequest={300}
                        heightRequest={300}
                        halign={Gtk.Align.CENTER}
                        cssClasses={["card"]}
                    />

                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isPlaying ? "Pause" : "Play"}
                            onClicked={handleTogglePlay}
                            cssClasses={isPlaying ? [] : ["suggested-action"]}
                        />
                        <GtkButton label="Reset" onClicked={handleReset} />
                    </GtkBox>

                    <GtkLabel
                        label={`Time: ${displayTime.toFixed(2)}s | Resolution: ${resolution}x${resolution}`}
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Animation Type">
                <GtkBox
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkButton
                        label="Plasma"
                        onClicked={() => setAnimationType("plasma")}
                        cssClasses={animationType === "plasma" ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="Wave"
                        onClicked={() => setAnimationType("wave")}
                        cssClasses={animationType === "wave" ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="Spiral"
                        onClicked={() => setAnimationType("spiral")}
                        cssClasses={animationType === "spiral" ? ["suggested-action"] : []}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Animation Settings">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Speed:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} hexpand>
                            <x.Adjustment
                                value={speed}
                                lower={0.1}
                                upper={3.0}
                                stepIncrement={0.1}
                                pageIncrement={0.5}
                                onValueChanged={setSpeed}
                            />
                        </GtkScale>
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Resolution:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} hexpand>
                            <x.Adjustment
                                value={resolution}
                                lower={32}
                                upper={256}
                                stepIncrement={16}
                                pageIncrement={32}
                                onValueChanged={(val) => setResolution(Math.floor(val))}
                            />
                        </GtkScale>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Performance Note">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Creating new textures each frame works for small sizes but is inefficient for large animations. For better performance, consider:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label={`- Use GtkGLArea for GPU-accelerated rendering
- Pre-generate frames and swap textures
- Use GtkMediaStream for video playback
- Implement a custom GdkPaintable subclass`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const paintableAnimatedDemo: Demo = {
    id: "paintable-animated",
    title: "Paintable/Animated Paintable",
    description: "Animated textures with frame updates",
    keywords: ["paintable", "animation", "texture", "procedural", "plasma", "wave", "spiral", "frame"],
    component: PaintableAnimatedDemo,
    sourceCode,
};

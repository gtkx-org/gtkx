import type { Context } from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkBox, GtkDrawingArea, GtkHeaderBar, GtkLabel, x } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./frames.tsx?raw";

interface Color {
    r: number;
    g: number;
    b: number;
}

const randomColor = (): Color => ({
    r: Math.random(),
    g: Math.random(),
    b: Math.random(),
});

const lerpColor = (c1: Color, c2: Color, t: number): Color => ({
    r: c1.r * (1 - t) + c2.r * t,
    g: c1.g * (1 - t) + c2.g * t,
    b: c1.b * (1 - t) + c2.b * t,
});

const TIME_SPAN_US = 3_000_000;

const FramesDemo = ({ window }: DemoProps) => {
    const drawingRef = useRef<Gtk.DrawingArea>(null);
    const [fps, setFps] = useState(0);

    useEffect(() => {
        const win = window.current;
        if (win) {
            win.setDefaultSize(600, 400);
        }
    }, [window]);

    const fpsAttrs = useMemo(() => {
        const attrs = new Pango.AttrList();
        attrs.insert(Pango.attrFontFeaturesNew("tnum=1"));
        return attrs;
    }, []);
    const tickIdRef = useRef<number | null>(null);
    const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const color1Ref = useRef<Color>({ r: 0, g: 0, b: 0 });
    const color2Ref = useRef<Color>({ r: 0, g: 0, b: 0 });
    const time2Ref = useRef<number>(0);
    const nowRef = useRef<number>(0);

    const draw = useCallback((cr: Context, width: number, height: number) => {
        const t = 1 - (time2Ref.current - nowRef.current) / TIME_SPAN_US;
        const color = lerpColor(color1Ref.current, color2Ref.current, Math.max(0, Math.min(1, t)));
        cr.setSourceRgb(color.r, color.g, color.b);
        cr.rectangle(0, 0, width, height);
        cr.fill();
    }, []);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const now = frameClock.getFrameTime();
        nowRef.current = now;

        if (time2Ref.current === 0) {
            time2Ref.current = now + TIME_SPAN_US;
        }

        if (now >= time2Ref.current) {
            time2Ref.current = now + TIME_SPAN_US;
            color1Ref.current = color2Ref.current;
            color2Ref.current = randomColor();
        }

        drawingRef.current?.queueDraw();
        return true;
    }, []);

    useEffect(() => {
        const area = drawingRef.current;
        if (!area) return;

        tickIdRef.current = area.addTickCallback(tickCallback);

        fpsIntervalRef.current = setInterval(() => {
            const frameClock = area.getFrameClock();
            if (frameClock) {
                setFps(frameClock.getFps());
            }
        }, 500);

        return () => {
            if (tickIdRef.current !== null) {
                area.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            if (fpsIntervalRef.current !== null) {
                clearInterval(fpsIntervalRef.current);
                fpsIntervalRef.current = null;
            }
        };
    }, [tickCallback]);

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkLabel label={`${fps.toFixed(2)} fps`} attributes={fpsAttrs} />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox>
                <GtkDrawingArea ref={drawingRef} onDraw={draw} hexpand vexpand />
            </GtkBox>
        </>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Benchmark/Frames",
    description:
        "This demo is intentionally as simple as possible, to see what framerate the windowing system can deliver on its own. It does nothing but change the drawn color, for every frame.",
    keywords: ["benchmark", "frames", "fps", "performance", "GdkFrameClock"],
    component: FramesDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

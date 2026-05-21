import type { Context } from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkBox, GtkDrawingArea, GtkHeaderBar, GtkLabel } from "@gtkx/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
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

function useFrameAnimationRefs() {
    const color1Ref = useRef<Color>({ r: 0, g: 0, b: 0 });
    const color2Ref = useRef<Color>({ r: 0, g: 0, b: 0 });
    const time2Ref = useRef<number>(0);
    const nowRef = useRef<number>(0);
    return { color1Ref, color2Ref, time2Ref, nowRef };
}

function useFrameTickAndFps(
    drawingRef: React.RefObject<Gtk.DrawingArea | null>,
    tickCallback: (widget: Gtk.Widget, frameClock: Gdk.FrameClock) => boolean,
    setFps: (fps: number) => void,
) {
    const tickIdRef = useRef<number | null>(null);
    const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    }, [tickCallback, drawingRef, setFps]);
}

function useFramesState(window: React.RefObject<Gtk.Window | null>) {
    const drawingRef = useRef<Gtk.DrawingArea>(null);
    const [fps, setFps] = useState(0);
    const animationRefs = useFrameAnimationRefs();

    useEffect(() => {
        const win = window.current;
        if (win) {
            win.setDefaultSize(600, 400);
        }
    }, [window]);

    const fpsAttrs = useMemo(() => {
        const attrs = Pango.AttrList.new();
        attrs.insert(Pango.attrFontFeaturesNew("tnum=1"));
        return attrs;
    }, []);

    const draw = useCallback(
        (cr: Context, width: number, height: number) => {
            const { time2Ref, nowRef, color1Ref, color2Ref } = animationRefs;
            const t = 1 - (time2Ref.current - nowRef.current) / TIME_SPAN_US;
            const color = lerpColor(color1Ref.current, color2Ref.current, Math.max(0, Math.min(1, t)));
            cr.setSourceRgb(color.r, color.g, color.b);
            cr.rectangle(0, 0, width, height);
            cr.fill();
        },
        [animationRefs],
    );

    const tickCallback = useCallback(
        (_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
            const { time2Ref, nowRef, color1Ref, color2Ref } = animationRefs;
            const now = frameClock.getFrameTime();
            nowRef.current = now;
            if (now >= time2Ref.current) {
                time2Ref.current = now + TIME_SPAN_US;
                color1Ref.current = color2Ref.current;
                color2Ref.current = randomColor();
            }
            drawingRef.current?.queueDraw();
            return true;
        },
        [animationRefs],
    );

    useFrameTickAndFps(drawingRef, tickCallback, setFps);

    return { drawingRef, fps, fpsAttrs, draw };
}

type FramesContextValue = ReturnType<typeof useFramesState>;

const FramesContext = createContext<FramesContextValue | null>(null);

const useFrames = (): FramesContextValue => {
    const ctx = useContext(FramesContext);
    if (!ctx) throw new Error("useFrames must be used inside a FramesProvider");
    return ctx;
};

const FramesProvider = ({ window, children }: DemoProviderProps) => {
    const value = useFramesState(window);
    return <FramesContext.Provider value={value}>{children}</FramesContext.Provider>;
};

const FramesTitlebar = () => {
    const { fps, fpsAttrs } = useFrames();
    return (
        <GtkHeaderBar>
            <GtkHeaderBar.PackEnd>
                <GtkLabel label={`${fps.toFixed(2)} fps`} attributes={fpsAttrs} />
            </GtkHeaderBar.PackEnd>
        </GtkHeaderBar>
    );
};

const FramesDemo = () => {
    const { drawingRef, draw } = useFrames();
    return (
        <GtkBox>
            <GtkDrawingArea ref={drawingRef} render={draw} hexpand vexpand />
        </GtkBox>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Benchmark/Frames",
    description:
        "This demo is intentionally as simple as possible, to see what framerate the windowing system can deliver on its own. It does nothing but change the drawn color, for every frame.",
    keywords: ["benchmark", "frames", "fps", "performance", "GdkFrameClock"],
    component: FramesDemo,
    titlebar: FramesTitlebar,
    provider: FramesProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

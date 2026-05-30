import { registerClass } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkBox, GtkHeaderBar, GtkLabel } from "@gtkx/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./frames.tsx?raw";

const COLOR_WIDGET_TYPE_NAME = "GtkxFramesColorWidget";

const TIME_SPAN_US = 3_000_000;

const randomColor = (): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = Math.random();
    rgba.green = Math.random();
    rgba.blue = Math.random();
    rgba.alpha = 1;
    return rgba;
};

const blackColor = (): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = 0;
    rgba.green = 0;
    rgba.blue = 0;
    rgba.alpha = 1;
    return rgba;
};

export class ColorWidget extends Gtk.Widget {
    private color1: Gdk.RGBA = blackColor();
    private color2: Gdk.RGBA = blackColor();
    private time2 = 0;
    private t = 0;

    constructed(): void {
        this.setHexpand(true);
        this.setVexpand(true);
        this.addTickCallback((widget, frameClock) => {
            const time = frameClock.getFrameTime();
            if (time >= this.time2) {
                this.time2 = time + TIME_SPAN_US;
                this.color1 = this.color2;
                this.color2 = randomColor();
            }
            this.t = 1 - (this.time2 - time) / TIME_SPAN_US;
            widget.queueDraw();
            return true;
        });
    }

    snapshot(snapshot: Gtk.Snapshot): void {
        const width = this.getWidth();
        const height = this.getHeight();
        const color = new Gdk.RGBA();
        color.red = (1 - this.t) * this.color1.red + this.t * this.color2.red;
        color.green = (1 - this.t) * this.color1.green + this.t * this.color2.green;
        color.blue = (1 - this.t) * this.color1.blue + this.t * this.color2.blue;
        color.alpha = 1;
        snapshot.appendColor(color, Graphene.Rect.create(0, 0, width, height));
    }
}

registerClass(ColorWidget, { gtypeName: COLOR_WIDGET_TYPE_NAME });

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            GtkxFramesColorWidget: {
                name?: string;
                hexpand?: boolean;
                vexpand?: boolean;
                ref?: React.Ref<ColorWidget>;
            };
        }
    }
}

const GtkxFramesColorWidget = COLOR_WIDGET_TYPE_NAME;

function useFramesState() {
    const [colorWidget, setColorWidget] = useState<ColorWidget | null>(null);
    const [fps, setFps] = useState(0);

    useEffect(() => {
        if (!colorWidget) return;
        const interval = setInterval(() => {
            const frameClock = colorWidget.getFrameClock();
            if (frameClock) setFps(frameClock.getFps());
        }, 500);
        return () => clearInterval(interval);
    }, [colorWidget]);

    const fpsAttrs = useMemo(() => {
        const attrs = Pango.AttrList.new();
        attrs.insert(Pango.attrFontFeaturesNew("tnum=1"));
        return attrs;
    }, []);

    return { setColorWidget, fps, fpsAttrs };
}

type FramesContextValue = ReturnType<typeof useFramesState>;

const FramesContext = createContext<FramesContextValue | null>(null);

const useFrames = (): FramesContextValue => {
    const ctx = useContext(FramesContext);
    if (!ctx) throw new Error("useFrames must be used inside a FramesProvider");
    return ctx;
};

const FramesProvider = ({ children }: DemoProviderProps) => {
    const value = useFramesState();
    return <FramesContext.Provider value={value}>{children}</FramesContext.Provider>;
};

const FramesTitlebar = () => {
    const { fps, fpsAttrs } = useFrames();
    return (
        <GtkHeaderBar
            name="frames-header"
            packEnd={<GtkLabel label={`${fps.toFixed(2)} fps`} attributes={fpsAttrs} />}
        />
    );
};

const FramesDemo = () => {
    const { setColorWidget } = useFrames();

    return (
        <GtkBox>
            <GtkxFramesColorWidget name="color-widget" ref={setColorWidget} hexpand vexpand />
        </GtkBox>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Benchmark/Frames",
    description:
        "This demo is intentionally as simple as possible, to see what framerate the windowing system can deliver on its own.\n\nIt does nothing but change the drawn color, for every frame.",
    keywords: [],
    component: FramesDemo,
    titlebar: FramesTitlebar,
    provider: FramesProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

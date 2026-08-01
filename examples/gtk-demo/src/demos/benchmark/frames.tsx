import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkBox, GtkHeaderBar, GtkLabel, type GtkWidgetProps } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react/internal";
import { registerClass } from "@gtkx/runtime";
import { randomInt } from "node:crypto";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./frames.tsx?raw";

type ColorWidgetProps = GtkWidgetProps<ColorWidget>;
type FramesContextValue = ReturnType<typeof useFramesState>;

const COLOR_WIDGET_TYPE_NAME = "GtkxFramesColorWidget";
const TIME_SPAN_US = 3_000_000;
const RANDOM_UNIT_STEPS = 1_000_000;

const GtkxFramesColorWidget: (props: ColorWidgetProps) => ReactNode =
    createElementComponent(COLOR_WIDGET_TYPE_NAME);

const FramesContext = createContext<FramesContextValue | null>(null);

const framesDemo: Demo = {
    id: "frames",
    title: "Benchmark/Frames",
    description:
        "This demo is intentionally as simple as possible, to see what framerate the windowing " +
        "system can deliver on its own.\n\nIt does nothing but change the drawn color, for every frame.",
    keywords: [],
    component: FramesDemo,
    titlebar: FramesTitlebar,
    provider: FramesProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

const randomUnit = (): number => randomInt(RANDOM_UNIT_STEPS) / RANDOM_UNIT_STEPS;

const randomColor = (): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = randomUnit();
    rgba.green = randomUnit();
    rgba.blue = randomUnit();
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

function useFramesState() {
    const [colorWidget, setColorWidget] = useState<ColorWidget | null>(null);
    const [fps, setFps] = useState(0);

    useEffect(() => {
        if (!colorWidget) {
            return;
        }

        const interval = setInterval(() => {
            const frameClock = colorWidget.getFrameClock();

            if (frameClock) {
                setFps(frameClock.getFps());
            }
        }, 500);

        return () => {
            clearInterval(interval);
        };
    }, [colorWidget]);

    const fpsAttrs = (() => {
        const attrs = Pango.AttrList.new();
        attrs.insert(Pango.AttrFontFeatures.new("tnum=1"));

        return attrs;
    })();

    return { setColorWidget, fps, fpsAttrs };
}

function useFrames(): FramesContextValue {
    const ctx = useContext(FramesContext);

    if (!ctx) {
        throw new Error("useFrames must be used inside a FramesProvider");
    }

    return ctx;
}

function FramesProvider({ children }: DemoProviderProps) {
    const value = useFramesState();

    return <FramesContext.Provider value={value}>{children}</FramesContext.Provider>;
}

function FramesTitlebar() {
    const { fps, fpsAttrs } = useFrames();

    return (
        <GtkHeaderBar name="frames-header" end={<GtkLabel attributes={fpsAttrs}>{`${fps.toFixed(2)} fps`}</GtkLabel>} />
    );
}

function FramesDemo() {
    const { setColorWidget } = useFrames();

    return (
        <GtkBox>
            <GtkxFramesColorWidget name="color-widget" ref={setColorWidget} hexpand vexpand />
        </GtkBox>
    );
}

class ColorWidget extends Gtk.Widget {
    static {
        registerClass(ColorWidget, { typeName: COLOR_WIDGET_TYPE_NAME });
    }

    private color1: Gdk.RGBA = blackColor();
    private color2: Gdk.RGBA = blackColor();
    private time2 = 0;
    private t = 0;

    constructor(props: ConstructorParameters<typeof Gtk.Widget>[0] = {}) {
        super(props);
        this.setHexpand(true);
        this.setVexpand(true);

        this.addTickCallback((widget, frameClock) => {
            const time = Number(frameClock.getFrameTime());

            if (time >= this.time2) {
                this.time2 = time + TIME_SPAN_US;
                this.color1 = this.color2;
                this.color2 = randomColor();
            }

            this.t = 1 - (this.time2 - time) / TIME_SPAN_US;
            widget.queueDraw();

            return GLib.SOURCE_CONTINUE;
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

export { framesDemo };

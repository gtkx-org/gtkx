import * as Gdk from "@gtkx/ffi/gdk";
import * as GdkPixbuf from "@gtkx/ffi/gdkpixbuf";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkPicture, GtkToggleButton, GtkVideo } from "@gtkx/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import floppybuddyGifPath from "../gestures/floppybuddy.gif";
import gtkLogoWebmPath from "../media/gtk-logo.webm";
import type { Demo, DemoProps } from "../types.js";
import alphatestPngPath from "./alphatest.png";
import gtkLogoSvgPath from "./gtk-logo.svg";
import sourceCode from "./images.tsx?raw";

let symbolicIcon: Gio.ThemedIcon | undefined;
function getSymbolicIcon() {
    if (!symbolicIcon) {
        symbolicIcon = Gio.ThemedIcon.newWithDefaultFallbacks("battery-level-10-charging-symbolic");
    }
    return symbolicIcon;
}

const PROGRESSIVE_ROWS_PER_TICK = 3;
const PROGRESSIVE_INTERVAL_MS = 150;

const ImagesDemo = ({ window }: DemoProps) => {
    const [widgetPaintable, setWidgetPaintable] = useState<Gtk.WidgetPaintable | null>(null);
    const [gifPaintable, setGifPaintable] = useState<Gtk.MediaFile | null>(null);
    const [progressiveTexture, setProgressiveTexture] = useState<Gdk.Texture | null>(null);
    const [insensitive, setInsensitive] = useState(false);
    const progressiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoFile = useMemo(() => Gio.fileNewForPath(gtkLogoWebmPath), []);

    useLayoutEffect(() => {
        try {
            const mediaFile = Gtk.MediaFile.newForFilename(floppybuddyGifPath);
            mediaFile.setLoop(true);
            mediaFile.play();
            setGifPaintable(mediaFile);
        } catch {}
    }, []);

    useEffect(() => {
        const win = window.current;
        if (win) {
            const paintable = new Gtk.WidgetPaintable(win);
            setWidgetPaintable(paintable);
        }
    }, [window]);

    useEffect(() => {
        let source: GdkPixbuf.Pixbuf;
        try {
            source = GdkPixbuf.Pixbuf.newFromFile(alphatestPngPath);
        } catch (e) {
            const dialog = new Gtk.AlertDialog();
            dialog.setMessage(`Failure reading image file 'alphatest.png': ${e}`);
            dialog.show(null);
            return;
        }

        const width = source.getWidth();
        const height = source.getHeight();
        const display = new GdkPixbuf.Pixbuf(
            GdkPixbuf.Colorspace.RGB,
            source.getHasAlpha(),
            source.getBitsPerSample(),
            width,
            height,
        );
        display.fill(0xaaaaaaff);
        setProgressiveTexture(new Gdk.Texture(display));

        let row = 0;
        const revealRows = () => {
            if (row >= height) return;
            const count = Math.min(PROGRESSIVE_ROWS_PER_TICK, height - row);
            source.copyArea(0, row, width, count, display, 0, row);
            row += count;
            setProgressiveTexture(new Gdk.Texture(display));
            if (row < height) {
                progressiveTimerRef.current = setTimeout(revealRows, PROGRESSIVE_INTERVAL_MS);
            }
        };
        progressiveTimerRef.current = setTimeout(revealRows, PROGRESSIVE_INTERVAL_MS);

        return () => {
            if (progressiveTimerRef.current) {
                clearTimeout(progressiveTimerRef.current);
            }
        };
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkBox spacing={16} sensitive={!insensitive}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Image" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkImage file={gtkLogoSvgPath} iconSize={Gtk.IconSize.LARGE} />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Animation" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkPicture paintable={gifPaintable} canShrink widthRequest={150} heightRequest={150} />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Symbolic icon" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkImage gicon={getSymbolicIcon()} iconSize={Gtk.IconSize.LARGE} />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Progressive" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkPicture
                            paintable={progressiveTexture}
                            canShrink
                            widthRequest={150}
                            heightRequest={150}
                            alternativeText="A slowly loading image"
                        />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Video" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkVideo autoplay loop widthRequest={200} heightRequest={150} file={videoFile} />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Paintable" cssClasses={["heading"]} />
                    <GtkPicture
                        paintable={widgetPaintable}
                        widthRequest={100}
                        heightRequest={100}
                        canShrink
                        valign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkBox>

            <GtkToggleButton
                label="_Insensitive"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.END}
                hexpand
                vexpand
                onToggled={(btn) => setInsensitive(btn.getActive())}
            />
        </GtkBox>
    );
};

export const imagesDemo: Demo = {
    id: "images",
    title: "Images",
    description:
        "GtkImage and GtkPicture are used to display an image; the image can be in a number of formats. GtkImage is the widget used to display icons or images that should be sized and styled like an icon, while GtkPicture is used for images that should be displayed as-is.",
    keywords: ["GdkPaintable", "GtkWidgetPaintable", "GtkImage", "GtkPicture", "GtkVideo", "GdkPixbufLoader"],
    component: ImagesDemo,
    sourceCode,
};

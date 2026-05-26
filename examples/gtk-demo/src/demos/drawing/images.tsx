import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkPicture, GtkSwitch, GtkToggleButton, GtkVideo } from "@gtkx/react";
import { useEffect, useMemo, useState } from "react";
import { path as floppybuddyGifPath } from "../gestures/floppybuddy.gif";
import gtkLogoWebmUri from "../media/gtk-logo.webm";
import type { Demo, DemoProps } from "../types.js";
import { path as animatedSvgPath } from "./animated.gpa";
import { path as gtkLogoSvgPath } from "./gtk-logo.svg";
import sourceCode from "./images.tsx?raw";
import { path as statefulSvgPath } from "./stateful.gpa";

let symbolicIcon: Gio.ThemedIcon | undefined;
function getSymbolicIcon() {
    if (!symbolicIcon) {
        symbolicIcon = Gio.ThemedIcon.newWithDefaultFallbacks("battery-level-10-charging-symbolic");
    }
    return symbolicIcon;
}

const loadSvgPaintable = (resourcePath: string): Gtk.Svg => {
    const bytes = Gio.resourcesLookupData(resourcePath, Gio.ResourceLookupFlags.NONE);
    const svg = Gtk.Svg.newFromBytes(bytes);
    svg.play();
    svg.setState(0);
    return svg;
};

function useGifPaintable() {
    const [gifPaintable, setGifPaintable] = useState<Gtk.MediaFile | null>(null);
    useEffect(() => {
        try {
            const mediaFile = Gtk.MediaFile.newForResource(floppybuddyGifPath);
            mediaFile.setLoop(true);
            mediaFile.play();
            setGifPaintable(mediaFile);
        } catch (e) {
            const dialog = new Gtk.AlertDialog();
            dialog.setMessage(`Failure loading GIF '${floppybuddyGifPath}': ${e}`);
            dialog.show(null);
        }
    }, []);
    return gifPaintable;
}

const ImagesPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <GtkLabel label={title} cssClasses={["heading"]} />
        <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {children}
        </GtkFrame>
    </GtkBox>
);

const StatefulIconPanel = () => {
    const svg = useMemo(() => loadSvgPaintable(statefulSvgPath), []);
    const [state, setState] = useState(false);

    const attachFrameClock = (image: Gtk.Widget) => {
        const frameClock = image.getFrameClock();
        if (frameClock) svg.setFrameClock(frameClock);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <ImagesPanel title="Stateful icon">
                <GtkImage paintable={svg} pixelSize={128} onRealize={attachFrameClock} />
            </ImagesPanel>
            <GtkSwitch
                halign={Gtk.Align.START}
                active={state}
                onStateSet={(value) => {
                    setState(value);
                    svg.setState(value ? 1 : 0);
                    return true;
                }}
            />
        </GtkBox>
    );
};

const PathAnimationPanel = () => {
    const svg = useMemo(() => loadSvgPaintable(animatedSvgPath), []);

    const attachFrameClock = (image: Gtk.Widget) => {
        const frameClock = image.getFrameClock();
        if (frameClock) svg.setFrameClock(frameClock);
    };

    return (
        <ImagesPanel title="Path animation">
            <GtkImage paintable={svg} pixelSize={128} onRealize={attachFrameClock} />
        </ImagesPanel>
    );
};

const ImagesDemo = ({ window }: DemoProps) => {
    const [widgetPaintable, setWidgetPaintable] = useState<Gtk.WidgetPaintable | null>(null);
    const gifPaintable = useGifPaintable();
    const [insensitive, setInsensitive] = useState(false);
    const videoFile = useMemo(() => Gio.fileNewForUri(gtkLogoWebmUri), []);

    useEffect(() => {
        const win = window.current;
        if (win) {
            const paintable = Gtk.WidgetPaintable.new(win);
            setWidgetPaintable(paintable);
        }
    }, [window]);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkBox name="image-strip" spacing={16} sensitive={!insensitive}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <ImagesPanel title="Image from a resource">
                        <GtkImage resource={gtkLogoSvgPath} iconSize={Gtk.IconSize.LARGE} />
                    </ImagesPanel>
                    <ImagesPanel title="Animation from a resource">
                        <GtkPicture
                            name="gif-picture"
                            paintable={gifPaintable}
                            canShrink
                            widthRequest={150}
                            heightRequest={150}
                        />
                    </ImagesPanel>
                    <ImagesPanel title="Symbolic themed icon">
                        <GtkImage gicon={getSymbolicIcon()} iconSize={Gtk.IconSize.LARGE} />
                    </ImagesPanel>
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <StatefulIconPanel />
                    <PathAnimationPanel />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <ImagesPanel title="Displaying video">
                        <GtkVideo
                            name="logo-video"
                            autoplay
                            loop
                            widthRequest={200}
                            heightRequest={150}
                            file={videoFile}
                        />
                    </ImagesPanel>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkLabel label="GtkWidgetPaintable" cssClasses={["heading"]} />
                        <GtkPicture
                            name="widget-paintable-picture"
                            paintable={widgetPaintable}
                            widthRequest={100}
                            heightRequest={100}
                            canShrink
                            valign={Gtk.Align.START}
                        />
                    </GtkBox>
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
        "GtkImage and GtkPicture are used to display an image; the image can be in a number of formats.\n\nGtkImage is the widget used to display icons or images that should be sized and styled like an icon, while GtkPicture is used for images that should be displayed as-is.\n\nThis demo code shows some of the more obscure cases, in the simple case a call to gtk_picture_new_for_file() or gtk_image_new_from_icon_name() is all you need.",
    keywords: ["GdkPaintable", "GtkWidgetPaintable"],
    component: ImagesDemo,
    sourceCode,
};

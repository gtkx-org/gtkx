import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkPicture, GtkSwitch, GtkToggleButton, GtkVideo } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { useMemo, useState } from "react";
import { path as animatedSvgPath } from "#data/demos/drawing/animated.gpa";
import { path as gtkLogoSvgPath } from "#data/demos/drawing/gtk-logo.svg";
import { path as statefulSvgPath } from "#data/demos/drawing/stateful.gpa";
import { path as floppybuddyGifPath } from "#data/demos/gestures/floppybuddy.gif";
import gtkLogoWebmUri from "#data/demos/media/gtk-logo.webm";
import type { Demo } from "../types.js";
import sourceCode from "./images.tsx?raw";

const imagesDemo: Demo = {
    id: "images",
    title: "Images",
    description:
        "GtkImage and GtkPicture are used to display an image; the image can be in a number of formats.\n\n" +
        "GtkImage is the widget used to display icons or images that should be sized and styled like an icon, " +
        "while GtkPicture is used for images that should be displayed as-is.\n\n" +
        "This demo code shows some of the more obscure cases, in the simple case a call to " +
        "gtk_picture_new_for_file() or gtk_image_new_from_icon_name() is all you need.",
    keywords: ["GdkPaintable", "GtkWidgetPaintable"],
    component: ImagesDemo,
    sourceCode,
};

const loadSvgPaintable = (resourcePath: string): Gtk.Svg => {
    const bytes = Gio.resourcesLookupData(resourcePath, Gio.ResourceLookupFlags.NONE);
    const svg = Gtk.Svg.newFromBytes(bytes);
    svg.play();
    svg.setState(0);

    return svg;
};

const createGifPaintable = (): Gtk.MediaFile | null => {
    try {
        const mediaFile = Gtk.MediaFile.newForResource(floppybuddyGifPath);
        mediaFile.play();

        return mediaFile;
    } catch (error) {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage(`Failure loading GIF '${floppybuddyGifPath}': ${String(error)}`);
        dialog.show(null);

        return null;
    }
};

const ImagesPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <GtkLabel cssClasses={["heading"]}>{title}</GtkLabel>
        <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {children}
        </GtkFrame>
    </GtkBox>
);

const SymbolicIconPanel = () => {
    const [symbolicIcon] = useState(() =>
        Gio.ThemedIcon.newWithDefaultFallbacks("battery-level-10-charging-symbolic"));

    return (
        <ImagesPanel title="Symbolic themed icon">
            <GtkImage gicon={symbolicIcon} iconSize={Gtk.IconSize.LARGE} />
        </ImagesPanel>
    );
};

const StatefulIconPanel = () => {
    const [svg] = useState(() => loadSvgPaintable(statefulSvgPath));
    const [state, setState] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <ImagesPanel title="Stateful icon">
                <GtkImage name="stateful-icon-image" paintable={svg} pixelSize={128} />
            </ImagesPanel>
            <GtkSwitch
                halign={Gtk.Align.START}
                active={state}
                onStateSet={(value) => {
                    setState(value);
                    svg.setState(value ? 1 : 0);

                    return Gdk.EVENT_STOP;
                }}
            />
        </GtkBox>
    );
};

const PathAnimationPanel = () => {
    const [svg] = useState(() => loadSvgPaintable(animatedSvgPath));

    return (
        <ImagesPanel title="Path animation">
            <GtkImage paintable={svg} pixelSize={128} />
        </ImagesPanel>
    );
};

const ResourcesColumn = ({ gifPaintable }: { gifPaintable: Gtk.MediaFile | null }) => (
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
        <SymbolicIconPanel />
    </GtkBox>
);

const VideoColumn = ({ widgetPaintable }: { widgetPaintable: Gtk.WidgetPaintable | null }) => {
    const videoFile = Gio.File.newForUri(gtkLogoWebmUri);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <ImagesPanel title="Displaying video">
                <GtkVideo name="logo-video" autoplay loop widthRequest={200} heightRequest={150} file={videoFile} />
            </ImagesPanel>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel cssClasses={["heading"]}>GtkWidgetPaintable</GtkLabel>
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
    );
};

function ImagesDemo() {
    const parentWindow = useParentWindow();
    const [gifPaintable] = useState(createGifPaintable);
    const [insensitive, setInsensitive] = useState(false);

    const widgetPaintable = useMemo(() => (parentWindow ? Gtk.WidgetPaintable.new(parentWindow) : null), [
        parentWindow,
    ]);

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
                <ResourcesColumn gifPaintable={gifPaintable} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <StatefulIconPanel />
                    <PathAnimationPanel />
                </GtkBox>
                <VideoColumn widgetPaintable={widgetPaintable} />
            </GtkBox>

            <GtkToggleButton
                label="_Insensitive"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.END}
                hexpand
                vexpand
                onToggled={(btn) => {
                    setInsensitive(btn.getActive());
                }}
            />
        </GtkBox>
    );
}

export { imagesDemo };

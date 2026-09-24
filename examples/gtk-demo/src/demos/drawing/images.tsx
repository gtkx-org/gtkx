import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GThemedIcon } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkPicture,
    GtkSvg,
    GtkSwitch,
    GtkToggleButton,
    GtkVideo,
    GtkWidgetPaintable,
} from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { useEffect, useState } from "react";
import type { Demo } from "../types.js";
import animatedSvgPath from "../../../data/demos/drawing/animated.gpa?resource";
import floppyBuddyWebmPath from "../../../data/demos/drawing/floppybuddy.webm?resource";
import gtkLogoSvgPath from "../../../data/demos/drawing/gtk-logo.svg?resource";
import statefulSvgPath from "../../../data/demos/drawing/stateful.gpa?resource";
import gtkLogoWebmPath from "../../../data/demos/media/gtk-logo.webm?resource";
import sourceCode from "./images.tsx?raw";

const imagesDemo: Demo = {
    id: "images",
    title: "Images",
    description:
        "GTKX can display resources, animated paintables, video and snapshots of existing widgets. GtkImage " +
        "fits icon-sized content, while GtkPicture lets visual content scale with its available space.",
    keywords: ["GdkPaintable", "GtkWidgetPaintable"],
    component: ImagesDemo,
    sourceCode,
};

function useAnimationPaintable(): Gtk.MediaFile | null {
    const [animation, setAnimation] = useState<Gtk.MediaFile | null>(null);

    useEffect(() => {
        let isActive = true;
        let paintable: Gtk.MediaFile | undefined;

        queueMicrotask(() => {
            if (!isActive) {
                return;
            }

            paintable = Gtk.MediaFile.newForResource(floppyBuddyWebmPath);
            paintable.setLoop(true);
            paintable.play();
            setAnimation(paintable);
        });

        return () => {
            isActive = false;
            paintable?.pause();
            paintable?.clear();
        };
    }, []);

    return animation;
}

const SvgImage = ({
    accessibleLabel,
    name,
    resource,
    state,
}: {
    accessibleLabel: string;
    name?: string;
    resource: string;
    state?: number;
}) => (
    <GtkImage
        accessibleLabel={accessibleLabel}
        name={name}
        paintable={<GtkSvg resource={resource} state={state} />}
        pixelSize={128}
        onMap={(image) => {
            const clock = image.getFrameClock();
            const svg = image.getPaintable();

            if (clock && svg instanceof Gtk.Svg) {
                svg.setFrameClock(clock);
                svg.play();
            }
        }}
        onUnmap={(image) => {
            const svg = image.getPaintable();

            if (svg instanceof Gtk.Svg) {
                svg.pause();
            }
        }}
    />
);

const ImagesPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <GtkLabel cssClasses={["heading"]}>{title}</GtkLabel>
        <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {children}
        </GtkFrame>
    </GtkBox>
);

const SymbolicIconPanel = () => {
    return (
        <ImagesPanel title="Symbolic themed icon">
            <GtkImage
                accessibleLabel="Battery at 10%, charging"
                gicon={<GThemedIcon name="battery-level-10-charging-symbolic" useDefaultFallbacks />}
                iconSize={Gtk.IconSize.LARGE}
            />
        </ImagesPanel>
    );
};

const StatefulIconPanel = () => {
    const [isOn, setIsOn] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <ImagesPanel title="Stateful icon">
                <SvgImage
                    accessibleLabel={isOn ? "Cross" : "Checkmark"}
                    name="stateful-icon-image"
                    resource={statefulSvgPath}
                    state={isOn ? 1 : 0}
                />
            </ImagesPanel>
            <GtkSwitch
                accessibleLabel="Stateful icon state"
                halign={Gtk.Align.START}
                active={isOn}
                onStateSet={(value) => {
                    setIsOn(value);

                    return Gdk.EVENT_STOP;
                }}
            />
        </GtkBox>
    );
};

const PathAnimationPanel = () => {
    return (
        <ImagesPanel title="Path animation">
            <SvgImage accessibleLabel="Animated path" name="path-animation-image" resource={animatedSvgPath} />
        </ImagesPanel>
    );
};

const ResourcesColumn = ({ animationPaintable }: { animationPaintable: Gtk.MediaFile | null }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <ImagesPanel title="Image from a resource">
            <GtkImage accessibleLabel="GTK logo" resource={gtkLogoSvgPath} iconSize={Gtk.IconSize.LARGE} />
        </ImagesPanel>
        <ImagesPanel title="Animation from a resource">
            <GtkPicture
                name="animation-picture"
                accessibleLabel="Animated Floppy Buddy"
                paintable={animationPaintable}
                canShrink
                widthRequest={150}
                heightRequest={150}
            />
        </ImagesPanel>
        <SymbolicIconPanel />
    </GtkBox>
);

const VideoColumn = ({ parentWindow }: { parentWindow: Gtk.Window | null }) => {
    const [videoFile] = useState(() => Gio.File.newForUri(`resource://${gtkLogoWebmPath}`));

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <ImagesPanel title="Displaying video">
                <GtkVideo
                    name="logo-video"
                    accessibleLabel="GTK logo video"
                    autoplay
                    loop
                    widthRequest={200}
                    heightRequest={150}
                    file={videoFile}
                />
            </ImagesPanel>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel cssClasses={["heading"]}>GtkWidgetPaintable</GtkLabel>
                <GtkPicture
                    name="widget-paintable-picture"
                    accessibleLabel="GTK Demo window snapshot"
                    paintable={<GtkWidgetPaintable widget={parentWindow} />}
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
    const animation = useAnimationPaintable();
    const [isInsensitive, setIsInsensitive] = useState(false);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkBox name="image-strip" spacing={16} sensitive={!isInsensitive}>
                <ResourcesColumn animationPaintable={animation} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <StatefulIconPanel />
                    <PathAnimationPanel />
                </GtkBox>
                <VideoColumn parentWindow={parentWindow} />
            </GtkBox>

            <GtkToggleButton
                label="_Insensitive"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.END}
                hexpand
                vexpand
                onToggled={(btn) => {
                    setIsInsensitive(btn.getActive());
                }}
            />
        </GtkBox>
    );
}

export { imagesDemo };

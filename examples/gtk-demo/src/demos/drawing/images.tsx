import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkToggleButton } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./images.tsx?raw";

const ImagesDemo = () => {
    const [insensitive, setInsensitive] = useState(false);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkBox spacing={16}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Symbolic themed icon" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkImage
                            iconName="battery-level-10-charging-symbolic"
                            iconSize={Gtk.IconSize.LARGE}
                            sensitive={!insensitive}
                        />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Icon from theme" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkImage iconName="folder-symbolic" pixelSize={64} sensitive={!insensitive} />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Dialog icons" cssClasses={["heading"]} />
                    <GtkFrame halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                        <GtkBox spacing={12} marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
                            <GtkImage iconName="dialog-information-symbolic" iconSize={Gtk.IconSize.LARGE} sensitive={!insensitive} />
                            <GtkImage iconName="dialog-warning-symbolic" iconSize={Gtk.IconSize.LARGE} sensitive={!insensitive} />
                            <GtkImage iconName="dialog-error-symbolic" iconSize={Gtk.IconSize.LARGE} sensitive={!insensitive} />
                        </GtkBox>
                    </GtkFrame>
                </GtkBox>
            </GtkBox>

            <GtkToggleButton
                label="_Insensitive"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.END}
                vexpand
                active={insensitive}
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
    keywords: ["GdkPaintable", "GtkWidgetPaintable"],
    component: ImagesDemo,
    sourceCode,
};

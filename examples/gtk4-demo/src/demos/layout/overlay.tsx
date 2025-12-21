import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkOverlay } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const OverlayDemo = () => {
    const [badgeCount, setBadgeCount] = useState(3);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Overlay" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Overlay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkOverlay stacks widgets on top of each other. The first child is the main content, and subsequent children are overlaid on top."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Badge Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.START}>
                    <GtkOverlay>
                        <GtkButton label="Notifications" widthRequest={120} heightRequest={40} />
                        <GtkLabel
                            label={String(badgeCount)}
                            cssClasses={["badge"]}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.START}
                            marginEnd={4}
                            marginTop={4}
                        />
                    </GtkOverlay>
                    <GtkButton label="+" onClicked={() => setBadgeCount((c) => c + 1)} />
                    <GtkButton label="-" onClicked={() => setBadgeCount((c) => Math.max(0, c - 1))} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Corner GtkLabels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkOverlay>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            widthRequest={200}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <GtkLabel label="Main Content" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label="TL"
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.START}
                            marginStart={8}
                            marginTop={8}
                        />
                        <GtkLabel
                            label="TR"
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.START}
                            marginEnd={8}
                            marginTop={8}
                        />
                        <GtkLabel
                            label="BL"
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.END}
                            marginStart={8}
                            marginBottom={8}
                        />
                        <GtkLabel
                            label="BR"
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.END}
                            marginEnd={8}
                            marginBottom={8}
                        />
                    </GtkOverlay>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Usage" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use halign and valign props on overlay children to position them. The first child becomes the base layer."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const overlayDemo: Demo = {
    id: "overlay",
    title: "Overlay",
    description: "Container that stacks widgets on top of each other.",
    keywords: ["overlay", "stack", "layer", "badge", "GtkOverlay"],
    component: OverlayDemo,
    sourcePath: getSourcePath(import.meta.url, "overlay.tsx"),
};

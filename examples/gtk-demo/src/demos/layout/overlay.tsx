import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkOverlay, GtkProgressBar, GtkSpinner, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./overlay.tsx?raw";

const OverlayDemo = () => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0.3);
    const [notificationCount, setNotificationCount] = useState(5);

    const toggleLoading = () => {
        setLoading(!loading);
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Overlay" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About Overlay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkOverlay is a container that stacks children on top of a main child. Overlay children can be positioned using halign/valign properties."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Notification Badge" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Common pattern for showing notification counts on buttons or icons."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={16}>
                    <GtkOverlay>
                        <GtkButton iconName="mail-unread-symbolic" widthRequest={48} heightRequest={48} />
                        {notificationCount > 0 && (
                            <x.OverlayChild>
                                <GtkLabel
                                    label={String(notificationCount)}
                                    cssClasses={["error", "pill", "numeric"]}
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.START}
                                />
                            </x.OverlayChild>
                        )}
                    </GtkOverlay>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} valign={Gtk.Align.CENTER}>
                        <GtkBox spacing={4}>
                            <GtkButton label="+1" onClicked={() => setNotificationCount(notificationCount + 1)} />
                            <GtkButton
                                label="-1"
                                onClicked={() => setNotificationCount(Math.max(0, notificationCount - 1))}
                            />
                            <GtkButton label="Clear" onClicked={() => setNotificationCount(0)} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Loading Overlay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Overlay a spinner or progress indicator over content while loading."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkButton
                    label={loading ? "Stop Loading" : "Start Loading"}
                    onClicked={toggleLoading}
                    cssClasses={["suggested-action"]}
                    halign={Gtk.Align.START}
                />
                <GtkOverlay>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        cssClasses={["card"]}
                        marginTop={8}
                        marginBottom={8}
                        marginStart={12}
                        marginEnd={12}
                        widthRequest={300}
                        heightRequest={120}
                    >
                        <GtkLabel
                            label="Content Area"
                            cssClasses={["heading"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            vexpand
                        />
                        <GtkLabel
                            label="This is the main content that can be covered by an overlay."
                            cssClasses={["dim-label"]}
                            wrap
                            halign={Gtk.Align.CENTER}
                        />
                    </GtkBox>
                    {loading && (
                        <x.OverlayChild>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                cssClasses={["background", "osd"]}
                                hexpand
                                vexpand
                            >
                                <GtkSpinner
                                    spinning
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                    vexpand
                                    widthRequest={32}
                                    heightRequest={32}
                                />
                                <GtkLabel
                                    label="Loading..."
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.CENTER}
                                    marginBottom={12}
                                />
                            </GtkBox>
                        </x.OverlayChild>
                    )}
                </GtkOverlay>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Corner Positioning" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Overlay children can be positioned at any corner using halign and valign."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkOverlay>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        cssClasses={["card"]}
                        widthRequest={280}
                        heightRequest={140}
                    >
                        <GtkLabel
                            label="Image or Content"
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            vexpand
                        />
                    </GtkBox>
                    <x.OverlayChild>
                        <GtkLabel
                            label="Top Left"
                            cssClasses={["accent", "caption"]}
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.START}
                            marginStart={8}
                            marginTop={8}
                        />
                    </x.OverlayChild>
                    <x.OverlayChild>
                        <GtkLabel
                            label="Top Right"
                            cssClasses={["accent", "caption"]}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.START}
                            marginEnd={8}
                            marginTop={8}
                        />
                    </x.OverlayChild>
                    <x.OverlayChild>
                        <GtkLabel
                            label="Bottom Left"
                            cssClasses={["accent", "caption"]}
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.END}
                            marginStart={8}
                            marginBottom={8}
                        />
                    </x.OverlayChild>
                    <x.OverlayChild>
                        <GtkLabel
                            label="Bottom Right"
                            cssClasses={["accent", "caption"]}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.END}
                            marginEnd={8}
                            marginBottom={8}
                        />
                    </x.OverlayChild>
                </GtkOverlay>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Progress Overlay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Overlay a progress bar at the bottom of content."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8}>
                    <GtkButton label="0%" onClicked={() => setProgress(0)} />
                    <GtkButton label="25%" onClicked={() => setProgress(0.25)} />
                    <GtkButton label="50%" onClicked={() => setProgress(0.5)} />
                    <GtkButton label="75%" onClicked={() => setProgress(0.75)} />
                    <GtkButton label="100%" onClicked={() => setProgress(1)} />
                </GtkBox>
                <GtkOverlay>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        cssClasses={["card"]}
                        widthRequest={300}
                        heightRequest={80}
                    >
                        <GtkLabel
                            label={`Download: ${Math.round(progress * 100)}%`}
                            cssClasses={["heading"]}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            vexpand
                        />
                    </GtkBox>
                    <x.OverlayChild>
                        <GtkProgressBar fraction={progress} valign={Gtk.Align.END} hexpand />
                    </x.OverlayChild>
                </GtkOverlay>
            </GtkBox>
        </GtkBox>
    );
};

export const overlayDemo: Demo = {
    id: "overlay",
    title: "Overlay",
    description: "Container that stacks widgets on top of a main child.",
    keywords: ["overlay", "stack", "badge", "loading", "layer", "GtkOverlay"],
    component: OverlayDemo,
    sourceCode,
};

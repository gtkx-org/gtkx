import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkFrame, GtkImage, GtkLabel, GtkRevealer } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./revealer.tsx?raw";

const RevealerDemo = () => {
    const [basicRevealed, setBasicRevealed] = useState(true);
    const [detailsRevealed, setDetailsRevealed] = useState(false);
    const [notificationRevealed, setNotificationRevealed] = useState(false);
    const [sidebarRevealed, setSidebarRevealed] = useState(true);
    const [transitionType, setTransitionType] = useState<Gtk.RevealerTransitionType>(
        Gtk.RevealerTransitionType.SLIDE_DOWN,
    );

    const transitionTypes = [
        { type: Gtk.RevealerTransitionType.NONE, label: "None" },
        { type: Gtk.RevealerTransitionType.CROSSFADE, label: "Crossfade" },
        { type: Gtk.RevealerTransitionType.SLIDE_DOWN, label: "Slide Down" },
        { type: Gtk.RevealerTransitionType.SLIDE_UP, label: "Slide Up" },
        { type: Gtk.RevealerTransitionType.SLIDE_LEFT, label: "Slide Left" },
        { type: Gtk.RevealerTransitionType.SLIDE_RIGHT, label: "Slide Right" },
    ];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Revealer" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About GtkRevealer" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkRevealer animates showing and hiding its child widget. It supports various transition types like sliding and crossfade. Perfect for expandable content, notifications, and sidebars."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Basic Revealer" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkButton
                        label={basicRevealed ? "Hide Content" : "Show Content"}
                        onClicked={() => setBasicRevealed(!basicRevealed)}
                        halign={Gtk.Align.START}
                    />
                    <GtkRevealer revealChild={basicRevealed} transitionType={transitionType} transitionDuration={300}>
                        <GtkFrame cssClasses={["card"]}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkLabel label="Revealed Content" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This content slides into view with a smooth animation. The revealer automatically handles the transition."
                                    wrap
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                />
                            </GtkBox>
                        </GtkFrame>
                    </GtkRevealer>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Transition Types" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Try different animation styles for the revealer above."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={4} halign={Gtk.Align.START}>
                    {transitionTypes.map((t) => (
                        <GtkButton
                            key={t.type}
                            label={t.label}
                            onClicked={() => setTransitionType(t.type)}
                            cssClasses={transitionType === t.type ? ["suggested-action"] : ["flat"]}
                        />
                    ))}
                </GtkBox>
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Expandable Details" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="Common pattern: click to expand and show more details."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkFrame cssClasses={["card"]}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkBox spacing={12}>
                                <GtkImage iconName="folder-documents-symbolic" pixelSize={32} />
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand>
                                    <GtkLabel label="Project Files" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                    <GtkLabel
                                        label="24 items, 156 MB"
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkButton
                                    iconName={detailsRevealed ? "go-up-symbolic" : "go-down-symbolic"}
                                    cssClasses={["flat", "circular"]}
                                    onClicked={() => setDetailsRevealed(!detailsRevealed)}
                                />
                            </GtkBox>
                            <GtkRevealer
                                revealChild={detailsRevealed}
                                transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                                transitionDuration={200}
                            >
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={12}>
                                    <GtkBox spacing={8}>
                                        <GtkLabel
                                            label="Created:"
                                            cssClasses={["dim-label"]}
                                            widthChars={12}
                                            xalign={0}
                                        />
                                        <GtkLabel label="December 15, 2024" />
                                    </GtkBox>
                                    <GtkBox spacing={8}>
                                        <GtkLabel
                                            label="Modified:"
                                            cssClasses={["dim-label"]}
                                            widthChars={12}
                                            xalign={0}
                                        />
                                        <GtkLabel label="December 27, 2024" />
                                    </GtkBox>
                                    <GtkBox spacing={8}>
                                        <GtkLabel
                                            label="Location:"
                                            cssClasses={["dim-label"]}
                                            widthChars={12}
                                            xalign={0}
                                        />
                                        <GtkLabel label="/home/user/Projects" />
                                    </GtkBox>
                                    <GtkBox spacing={8} marginTop={8}>
                                        <GtkButton label="Open" cssClasses={["suggested-action"]} />
                                        <GtkButton label="Properties" />
                                    </GtkBox>
                                </GtkBox>
                            </GtkRevealer>
                        </GtkBox>
                    </GtkFrame>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Notification Banner" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkButton
                        label="Show Notification"
                        onClicked={() => setNotificationRevealed(true)}
                        halign={Gtk.Align.START}
                        sensitive={!notificationRevealed}
                    />
                    <GtkRevealer
                        revealChild={notificationRevealed}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                        transitionDuration={250}
                    >
                        <GtkFrame cssClasses={["card"]}>
                            <GtkBox spacing={12} marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
                                <GtkImage iconName="emblem-ok-symbolic" pixelSize={24} cssClasses={["success"]} />
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand>
                                    <GtkLabel
                                        label="Changes saved successfully"
                                        cssClasses={["heading"]}
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkLabel
                                        label="Your preferences have been updated."
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkButton
                                    iconName="window-close-symbolic"
                                    cssClasses={["flat", "circular"]}
                                    onClicked={() => setNotificationRevealed(false)}
                                />
                            </GtkBox>
                        </GtkFrame>
                    </GtkRevealer>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Sidebar Toggle" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkCheckButton
                        label="Show Sidebar"
                        active={sidebarRevealed}
                        onToggled={(self) => setSidebarRevealed(self.getActive())}
                    />
                    <GtkBox heightRequest={120}>
                        <GtkRevealer
                            revealChild={sidebarRevealed}
                            transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
                            transitionDuration={200}
                        >
                            <GtkFrame cssClasses={["card"]} widthRequest={150}>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <GtkButton label="Home" cssClasses={["flat"]} />
                                    <GtkButton label="Library" cssClasses={["flat"]} />
                                    <GtkButton label="Settings" cssClasses={["flat"]} />
                                </GtkBox>
                            </GtkFrame>
                        </GtkRevealer>
                        <GtkFrame cssClasses={["card"]} hexpand>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Main Content Area" cssClasses={["title-3"]} />
                                <GtkLabel
                                    label="Toggle the sidebar to see the reveal animation"
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </GtkFrame>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="revealChild: Whether to show the child widget. transitionType: Animation style (CROSSFADE, SLIDE_DOWN, SLIDE_UP, SLIDE_LEFT, SLIDE_RIGHT). transitionDuration: Animation duration in milliseconds. childRevealed: Read-only, whether the animation has completed."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const revealerDemo: Demo = {
    id: "revealer",
    title: "Revealer",
    description: "Animated show/hide transitions with GtkRevealer.",
    keywords: [
        "revealer",
        "animation",
        "show",
        "hide",
        "transition",
        "slide",
        "fade",
        "GtkRevealer",
        "expand",
        "collapse",
    ],
    component: RevealerDemo,
    sourceCode,
};

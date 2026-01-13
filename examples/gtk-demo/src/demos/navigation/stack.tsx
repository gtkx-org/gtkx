import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkStack, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./stack.tsx?raw";

const StackDemo = () => {
    const [currentPage, setCurrentPage] = useState("home");
    const [transitionType, setTransitionType] = useState<Gtk.StackTransitionType>(
        Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    );

    const pages = [
        { name: "home", title: "Home", icon: "go-home-symbolic" },
        { name: "search", title: "Search", icon: "system-search-symbolic" },
        { name: "settings", title: "Settings", icon: "emblem-system-symbolic" },
    ];

    const transitionTypes = [
        { type: Gtk.StackTransitionType.NONE, label: "None" },
        { type: Gtk.StackTransitionType.CROSSFADE, label: "Crossfade" },
        { type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT, label: "Slide Left/Right" },
        { type: Gtk.StackTransitionType.SLIDE_UP_DOWN, label: "Slide Up/Down" },
        { type: Gtk.StackTransitionType.OVER_UP, label: "Over Up" },
        { type: Gtk.StackTransitionType.OVER_DOWN, label: "Over Down" },
        { type: Gtk.StackTransitionType.OVER_LEFT, label: "Over Left" },
        { type: Gtk.StackTransitionType.OVER_RIGHT, label: "Over Right" },
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
            <GtkLabel label="Stack" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About GtkStack" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkStack shows one child at a time with animated transitions between pages. Unlike GtkNotebook, it doesn't include built-in navigation controls - use GtkStackSwitcher or GtkStackSidebar to provide navigation."
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
                    <GtkLabel label="Stack with Switcher" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="GtkStackSwitcher provides a row of buttons to switch between pages."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkStack page={currentPage} transitionType={transitionType} transitionDuration={300}>
                        <x.StackPage id="home" title="Home" iconName="go-home-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                marginTop={20}
                                marginBottom={20}
                                valign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Welcome Home" cssClasses={["title-1"]} />
                                <GtkLabel
                                    label="This is the home page. Navigate using the buttons above or below."
                                    wrap
                                    halign={Gtk.Align.CENTER}
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </x.StackPage>
                        <x.StackPage id="search" title="Search" iconName="system-search-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                marginTop={20}
                                marginBottom={20}
                                valign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Search" cssClasses={["title-1"]} />
                                <GtkLabel
                                    label="The search page allows users to find content."
                                    wrap
                                    halign={Gtk.Align.CENTER}
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </x.StackPage>
                        <x.StackPage id="settings" title="Settings" iconName="emblem-system-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                marginTop={20}
                                marginBottom={20}
                                valign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Settings" cssClasses={["title-1"]} />
                                <GtkLabel
                                    label="Configure application preferences here."
                                    wrap
                                    halign={Gtk.Align.CENTER}
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </x.StackPage>
                    </GtkStack>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Programmatic Navigation" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Navigate between pages programmatically by setting the page prop."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                    {pages.map((page) => (
                        <GtkButton
                            key={page.name}
                            label={page.title}
                            onClicked={() => setCurrentPage(page.name)}
                            cssClasses={currentPage === page.name ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
                <GtkLabel label={`Current page: ${currentPage}`} cssClasses={["dim-label"]} halign={Gtk.Align.CENTER} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Transition Types" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Choose different animation styles for page transitions."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={4} halign={Gtk.Align.CENTER}>
                    {transitionTypes.slice(0, 4).map((t) => (
                        <GtkButton
                            key={t.type}
                            label={t.label}
                            onClicked={() => setTransitionType(t.type)}
                            cssClasses={transitionType === t.type ? ["suggested-action"] : ["flat"]}
                        />
                    ))}
                </GtkBox>
                <GtkBox spacing={4} halign={Gtk.Align.CENTER}>
                    {transitionTypes.slice(4).map((t) => (
                        <GtkButton
                            key={t.type}
                            label={t.label}
                            onClicked={() => setTransitionType(t.type)}
                            cssClasses={transitionType === t.type ? ["suggested-action"] : ["flat"]}
                        />
                    ))}
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="page: ID of the currently visible page. transitionType: Animation style (CROSSFADE, SLIDE_*, OVER_*, etc.). transitionDuration: Animation duration in milliseconds. hhomogeneous/vhomogeneous: Whether all children get the same size."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description: "Animated page switching with GtkStack and StackSwitcher.",
    keywords: ["stack", "pages", "navigation", "transition", "animation", "GtkStack", "StackPage", "switcher"],
    component: StackDemo,
    sourceCode,
};

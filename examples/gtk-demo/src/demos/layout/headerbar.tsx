import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkLabel, GtkMenuButton, GtkSearchBar, GtkSearchEntry, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./headerbar.tsx?raw";

const HeaderBarDemo = () => {
    const [searchMode, setSearchMode] = useState(false);
    const [subtitle, setSubtitle] = useState("Subtitle text");

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="HeaderBar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About HeaderBar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkHeaderBar is a container typically used as a title bar for windows. It provides slots for controls at the start, end, and center (titleWidget)."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Basic HeaderBar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="A simple header with title and common controls."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkHeaderBar showTitleButtons={false}>
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel label="My Application" cssClasses={["title"]} />
                        </x.Slot>
                        <x.PackEnd>
                            <GtkMenuButton iconName="open-menu-symbolic" />
                        </x.PackEnd>
                    </GtkHeaderBar>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Navigation Controls" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Add controls at the start (default child placement) for navigation or actions."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkHeaderBar showTitleButtons={false}>
                        <x.PackStart>
                            <GtkButton iconName="go-previous-symbolic" cssClasses={["flat"]} />
                            <GtkButton iconName="go-next-symbolic" cssClasses={["flat"]} />
                        </x.PackStart>
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel label="History" cssClasses={["title"]} />
                        </x.Slot>
                        <x.PackEnd>
                            <GtkButton label="Clear" cssClasses={["destructive-action"]} />
                        </x.PackEnd>
                    </GtkHeaderBar>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Title and Subtitle" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use the titleWidget slot to create a custom title area with subtitle."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkHeaderBar showTitleButtons={false}>
                        <x.PackStart>
                            <GtkButton iconName="list-add-symbolic" cssClasses={["flat"]} />
                        </x.PackStart>
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
                                <GtkLabel label="Document.txt" cssClasses={["title"]} />
                                <GtkLabel label={subtitle} cssClasses={["subtitle"]} />
                            </GtkBox>
                        </x.Slot>
                        <x.PackEnd>
                            <GtkButton iconName="document-save-symbolic" cssClasses={["flat"]} />
                            <GtkMenuButton iconName="view-more-symbolic" cssClasses={["flat"]} />
                        </x.PackEnd>
                    </GtkHeaderBar>
                </GtkBox>
                <GtkBox spacing={8}>
                    <GtkButton label="Modified" onClicked={() => setSubtitle("Modified")} />
                    <GtkButton label="Saved" onClicked={() => setSubtitle("Saved")} />
                    <GtkButton label="~/Documents" onClicked={() => setSubtitle("~/Documents")} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Search Integration" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="HeaderBar commonly integrates with a SearchBar below."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkHeaderBar showTitleButtons={false}>
                        <x.PackStart>
                            <GtkButton
                                iconName="edit-find-symbolic"
                                cssClasses={searchMode ? ["suggested-action"] : ["flat"]}
                                onClicked={() => setSearchMode(!searchMode)}
                            />
                        </x.PackStart>
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel label="Files" cssClasses={["title"]} />
                        </x.Slot>
                        <x.PackEnd>
                            <GtkMenuButton iconName="open-menu-symbolic" cssClasses={["flat"]} />
                        </x.PackEnd>
                    </GtkHeaderBar>
                    <GtkSearchBar searchModeEnabled={searchMode}>
                        <GtkSearchEntry hexpand placeholderText="Search files..." />
                    </GtkSearchBar>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Action Header" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Modal dialogs or selection mode often use action-focused headers."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkHeaderBar showTitleButtons={false}>
                        <x.PackStart>
                            <GtkButton label="Cancel" cssClasses={["flat"]} />
                        </x.PackStart>
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel label="Select Items" cssClasses={["title"]} />
                        </x.Slot>
                        <x.PackEnd>
                            <GtkButton label="Done" cssClasses={["suggested-action"]} />
                        </x.PackEnd>
                    </GtkHeaderBar>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="showTitleButtons: Show/hide window controls (close, minimize, maximize). decorationLayout: Customize which buttons appear and their order. titleWidget: Slot for center content (typically title)."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const headerbarDemo: Demo = {
    id: "headerbar",
    title: "Header Bar",
    description:
        "GtkHeaderBar is a container that is suitable for implementing window titlebars. One of its features is that it can position a title centered with regard to the full width, regardless of variable-width content at the left or right.",
    keywords: ["headerbar", "title", "titlebar", "window", "navigation", "GtkHeaderBar", "GtkWindowHandle", "GtkWindowControls"],
    component: HeaderBarDemo,
    sourceCode,
};

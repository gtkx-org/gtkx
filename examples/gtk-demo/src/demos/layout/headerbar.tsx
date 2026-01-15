import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkSwitch, GtkTextView, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./headerbar.tsx?raw";

/**
 * Header Bar demo matching the official GTK gtk-demo.
 * GtkHeaderBar is a container suitable for implementing window titlebars.
 */
const HeaderBarDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkHeaderBar showTitleButtons={false}>
                <x.PackStart>
                    <GtkBox cssClasses={["linked"]}>
                        <GtkButton iconName="go-previous-symbolic" tooltipText="Back" />
                        <GtkButton iconName="go-next-symbolic" tooltipText="Forward" />
                    </GtkBox>
                </x.PackStart>
                <x.PackStart>
                    <GtkSwitch />
                </x.PackStart>
                <x.PackEnd>
                    <GtkButton iconName="mail-send-receive-symbolic" tooltipText="Check out" />
                </x.PackEnd>
            </GtkHeaderBar>
            <GtkTextView hexpand vexpand />
        </GtkBox>
    );
};

export const headerbarDemo: Demo = {
    id: "headerbar",
    title: "Header Bar",
    description:
        "GtkHeaderBar is a container that is suitable for implementing window titlebars. One of its features is that it can position a title centered with regard to the full width, regardless of variable-width content at the left or right.",
    keywords: ["headerbar", "GtkHeaderBar", "GtkWindowHandle", "GtkWindowControls", "titlebar"],
    component: HeaderBarDemo,
    sourceCode,
};

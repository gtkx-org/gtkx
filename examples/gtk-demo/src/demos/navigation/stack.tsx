import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkImage, GtkSpinner, GtkStack, GtkStackSwitcher } from "@gtkx/react";
import { useMemo } from "react";
import demoIconUri from "../../icons/org.gtk.Demo4.svg";
import type { Demo } from "../types.js";
import sourceCode from "./stack.tsx?raw";

/**
 * Stack demo matching the official GTK gtk-demo.
 * Shows a stack with three pages and a GtkStackSwitcher.
 */
const StackDemo = () => {
    const demoIcon = useMemo<Gio.Icon>(() => Gio.FileIcon.new(Gio.fileNewForUri(demoIconUri)), []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkStackSwitcher halign={Gtk.Align.CENTER} />
            <GtkStack name="stack" transitionType={Gtk.StackTransitionType.CROSSFADE}>
                <GtkStack.Page id="page1" title="Page 1">
                    <GtkImage gicon={demoIcon} pixelSize={100} marginTop={20} marginBottom={20} />
                </GtkStack.Page>
                <GtkStack.Page id="page2" title="Page 2">
                    <GtkCheckButton label="Page 2" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkStack.Page>
                <GtkStack.Page id="page3" iconName="face-laugh-symbolic">
                    <GtkSpinner spinning halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkStack.Page>
            </GtkStack>
        </GtkBox>
    );
};

export const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description:
        "GtkStack is a container that shows a single child at a time, with nice transitions when the visible child changes.\n\nGtkStackSwitcher adds buttons to control which child is visible.",
    keywords: [],
    component: StackDemo,
    sourceCode,
    resizable: false,
};

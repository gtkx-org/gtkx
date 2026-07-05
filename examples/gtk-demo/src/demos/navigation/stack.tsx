import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkImage, GtkSpinner, GtkStack, GtkStackPage, GtkStackSwitcher } from "@gtkx/jsx/gtk";
import { useState } from "react";
import demoIconUri from "#data/icons/org.gtk.Demo4.svg";
import type { Demo } from "../types.js";
import sourceCode from "./stack.tsx?raw";

const StackDemo = () => {
    const demoIcon = Gio.FileIcon.new(Gio.fileNewForUri(demoIconUri));
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkStackSwitcher halign={Gtk.Align.CENTER} stack={stack} />
            <GtkStack ref={setStack} name="stack" transitionType={Gtk.StackTransitionType.CROSSFADE}>
                <GtkStackPage name="page1" title="Page 1">
                    <GtkImage gicon={demoIcon} pixelSize={100} marginTop={20} marginBottom={20} />
                </GtkStackPage>
                <GtkStackPage name="page2" title="Page 2">
                    <GtkCheckButton label="Page 2" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkStackPage>
                <GtkStackPage name="page3" iconName="face-laugh-symbolic">
                    <GtkSpinner spinning halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkStackPage>
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

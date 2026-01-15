import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkImage, GtkSpinner, GtkStack, GtkStackSwitcher, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./stack.tsx?raw";

/**
 * Stack demo matching the official GTK gtk-demo.
 * Shows a stack with three pages and a GtkStackSwitcher.
 */
const StackDemo = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkStackSwitcher stack={stack ?? undefined} halign={Gtk.Align.CENTER} />
            <GtkStack ref={setStack} transitionType={Gtk.StackTransitionType.CROSSFADE}>
                <x.StackPage id="page1" title="Page 1">
                    <GtkImage iconName="org.gtk.Demo4" pixelSize={100} marginTop={20} marginBottom={20} />
                </x.StackPage>
                <x.StackPage id="page2" title="Page 2">
                    <GtkCheckButton label="Page 2" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </x.StackPage>
                <x.StackPage id="page3" iconName="face-laugh-symbolic">
                    <GtkSpinner spinning halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </x.StackPage>
            </GtkStack>
        </GtkBox>
    );
};

export const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description:
        "GtkStack is a container that shows a single child at a time, with nice transitions when the visible child changes. GtkStackSwitcher adds buttons to control which child is visible.",
    keywords: ["stack", "GtkStack", "GtkStackSwitcher", "StackPage", "transition"],
    component: StackDemo,
    sourceCode,
};

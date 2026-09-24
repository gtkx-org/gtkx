import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkImage, GtkSpinner, GtkStack, GtkStackPage, GtkStackSwitcher } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import demoIconPath from "../../../data/icons/org.gtk.Demo4.svg?resource";
import sourceCode from "./stack.tsx?raw";

const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description:
        "GtkStack is a container that shows a single child at a time, with nice transitions when the visible child " +
        "changes.\n\nGtkStackSwitcher adds buttons to control which child is visible.",
    keywords: [],
    component: StackDemo,
    sourceCode,
    isResizable: false,
};

function StackDemo() {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkStackSwitcher halign={Gtk.Align.CENTER} stack={stack} accessibleLabel="Stack pages" />
            <GtkStack ref={setStack} name="stack" transitionType={Gtk.StackTransitionType.CROSSFADE}>
                <GtkStackPage name="page1" title="Page 1">
                    <GtkImage
                        resource={demoIconPath}
                        pixelSize={100}
                        marginTop={20}
                        marginBottom={20}
                        accessibleLabel="GTK Demo logo"
                    />
                </GtkStackPage>
                <GtkStackPage name="page2" title="Page 2">
                    <GtkCheckButton label="Page 2" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkStackPage>
                <GtkStackPage name="page3" title="Page 3" iconName="face-laugh-symbolic">
                    <GtkSpinner
                        spinning
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        accessibleLabel="Loading Page 3"
                    />
                </GtkStackPage>
            </GtkStack>
        </GtkBox>
    );
}

export { stackDemo };

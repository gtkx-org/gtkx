import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkStack, GtkStackSidebar, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sidebar.tsx?raw";

const pages = [
    "Welcome to GTK",
    "GtkStackSidebar Widget",
    "Automatic navigation",
    "Consistent appearance",
    "Scrolling",
    "Page 6",
    "Page 7",
    "Page 8",
    "Page 9",
];

/**
 * Stack Sidebar demo matching the official GTK gtk-demo.
 * Shows a GtkStackSidebar controlling a GtkStack with multiple pages.
 */
const SidebarDemo = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkBox>
            <GtkStackSidebar stack={stack ?? undefined} />
            <GtkStack
                ref={setStack}
                transitionType={Gtk.StackTransitionType.SLIDE_UP_DOWN}
                hexpand
            >
                {pages.map((title, index) => (
                    <x.StackPage key={title} id={title} title={title}>
                        {index === 0 ? (
                            <GtkImage
                                iconName="org.gtk.Demo4"
                                pixelSize={256}
                                marginTop={20}
                                marginBottom={20}
                                cssClasses={["icon-dropshadow"]}
                            />
                        ) : (
                            <GtkLabel label={title} />
                        )}
                    </x.StackPage>
                ))}
            </GtkStack>
        </GtkBox>
    );
};

export const sidebarDemo: Demo = {
    id: "sidebar",
    title: "Stack Sidebar",
    description:
        "GtkStackSidebar provides an automatic sidebar widget to control navigation of a GtkStack object. This widget automatically updates its content based on what is presently available in the GtkStack object, and using the \"title\" child property to set the display labels.",
    keywords: ["sidebar", "GtkStackSidebar", "GtkStack", "navigation"],
    component: SidebarDemo,
    sourceCode,
};

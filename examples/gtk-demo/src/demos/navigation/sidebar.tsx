import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkPicture, GtkStack, GtkStackSidebar } from "@gtkx/react";
import { useMemo, useState } from "react";
import gtkLogoSvgPath from "../drawing/gtk-logo.svg";
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
    const gtkLogo = useMemo(() => Gdk.Texture.newFromFilename(gtkLogoSvgPath), []);

    return (
        <GtkBox>
            {stack && <GtkStackSidebar stack={stack} />}
            <GtkStack ref={setStack} transitionType={Gtk.StackTransitionType.SLIDE_UP_DOWN} hexpand>
                {pages.map((title, index) => (
                    <GtkStack.Page key={title} id={title} title={title}>
                        {index === 0 ? (
                            <GtkPicture
                                paintable={gtkLogo}
                                widthRequest={256}
                                heightRequest={256}
                                canShrink
                                cssClasses={["icon-dropshadow"]}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                            />
                        ) : (
                            <GtkLabel label={title} />
                        )}
                    </GtkStack.Page>
                ))}
            </GtkStack>
        </GtkBox>
    );
};

export const sidebarDemo: Demo = {
    id: "sidebar",
    title: "Stack Sidebar",
    description:
        'GtkStackSidebar provides an automatic sidebar widget to control navigation of a GtkStack object. This widget automatically updates its content based on what is presently available in the GtkStack object, and using the "title" child property to set the display labels.',
    keywords: ["gtkstack", "gtkstacksidebar"],
    component: SidebarDemo,
    sourceCode,
};

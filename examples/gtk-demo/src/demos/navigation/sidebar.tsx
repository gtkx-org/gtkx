import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkHeaderBar, GtkImage, GtkLabel, GtkStack, GtkStackSidebar } from "@gtkx/react";
import { useMemo } from "react";
import demoIconUri from "../../icons/org.gtk.Demo4.svg";
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

const SidebarDemo = () => {
    const demoIcon = useMemo<Gio.Icon>(() => Gio.FileIcon.new(Gio.fileNewForUri(demoIconUri)), []);

    return (
        <GtkBox>
            <GtkStackSidebar name="sidebar" />
            <GtkStack name="stack" transitionType={Gtk.StackTransitionType.SLIDE_UP_DOWN} hexpand>
                {pages.map((title, index) => (
                    <GtkStack.Page key={title} id={title} title={title}>
                        {index === 0 ? (
                            <GtkImage
                                gicon={demoIcon}
                                pixelSize={256}
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

const SidebarTitlebar = () => <GtkHeaderBar />;

export const sidebarDemo: Demo = {
    id: "sidebar",
    title: "Stack Sidebar",
    description:
        'GtkStackSidebar provides an automatic sidebar widget to control navigation of a GtkStack object. This widget automatically updates its content based on what is presently available in the GtkStack object, and using the "title" child property to set the display labels.',
    keywords: [],
    component: SidebarDemo,
    titlebar: SidebarTitlebar,
    sourceCode,
};

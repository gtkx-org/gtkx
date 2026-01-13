import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import type { Demo } from "../demos/types.js";

interface DemoPanelProps {
    demo: Demo | null;
}

export const DemoPanel = ({ demo }: DemoPanelProps) => {
    if (!demo) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <GtkLabel label="Select a demo" cssClasses={["dim-label", "title-2"]} />
            </GtkBox>
        );
    }

    const DemoComponent = demo.component;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand hexpand>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={4}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel label={demo.title} halign={Gtk.Align.START} cssClasses={["title-1"]} />
                <GtkLabel label={demo.description} halign={Gtk.Align.START} cssClasses={["dim-label"]} wrap />
            </GtkBox>

            <GtkScrolledWindow vexpand hexpand>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <DemoComponent />
                </GtkBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkScrolledWindow, Slot } from "@gtkx/react";
import type { Demo } from "../demos/types.js";

interface DemoPanelProps {
    demo: Demo | null;
}

export const DemoPanel = ({ demo }: DemoPanelProps) => {
    if (!demo) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <GtkLabel label="Select a demo from the sidebar" cssClasses={["dim-label"]} />
            </GtkBox>
        );
    }

    const DemoComponent = demo.component;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                marginStart={16}
                marginEnd={16}
                marginTop={16}
                marginBottom={8}
            >
                <GtkLabel label={demo.title} cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={demo.description}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                    marginTop={4}
                    wrap
                />
            </GtkBox>
            <GtkScrolledWindow vexpand hexpand>
                <GtkFrame marginStart={16} marginEnd={16} marginTop={8} marginBottom={16}>
                    <Slot for={GtkFrame} id="child">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            marginStart={16}
                            marginEnd={16}
                            marginTop={16}
                            marginBottom={16}
                        >
                            <DemoComponent />
                        </GtkBox>
                    </Slot>
                </GtkFrame>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

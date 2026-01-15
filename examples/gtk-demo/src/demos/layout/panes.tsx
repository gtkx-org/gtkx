import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkPaned, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./panes.tsx?raw";

/**
 * Paned Widgets demo matching the official GTK gtk-demo.
 * Shows nested horizontal and vertical panes with simple labels.
 */
const PanesDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={8}
            marginEnd={8}
            marginTop={8}
            marginBottom={8}
        >
            <GtkFrame>
                <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild={false} shrinkEndChild={false}>
                    <x.Slot for={GtkPaned} id="startChild">
                        <GtkPaned shrinkStartChild={false} shrinkEndChild={false}>
                            <x.Slot for={GtkPaned} id="startChild">
                                <GtkLabel
                                    label="Hi there"
                                    marginStart={4}
                                    marginEnd={4}
                                    marginTop={4}
                                    marginBottom={4}
                                    hexpand
                                    vexpand
                                />
                            </x.Slot>
                            <x.Slot for={GtkPaned} id="endChild">
                                <GtkLabel
                                    label="Hello"
                                    marginStart={4}
                                    marginEnd={4}
                                    marginTop={4}
                                    marginBottom={4}
                                    hexpand
                                    vexpand
                                />
                            </x.Slot>
                        </GtkPaned>
                    </x.Slot>
                    <x.Slot for={GtkPaned} id="endChild">
                        <GtkLabel
                            label="Goodbye"
                            marginStart={4}
                            marginEnd={4}
                            marginTop={4}
                            marginBottom={4}
                            hexpand
                            vexpand
                        />
                    </x.Slot>
                </GtkPaned>
            </GtkFrame>
        </GtkBox>
    );
};

export const panesDemo: Demo = {
    id: "panes",
    title: "Paned Widgets",
    description:
        "The GtkPaned Widget divides its content area into two panes with a divider in between that the user can adjust. A separate child is placed into each pane. GtkPaned widgets can be split horizontally or vertically. This test contains both a horizontal and a vertical GtkPaned widget.",
    keywords: ["paned", "GtkPaned"],
    component: PanesDemo,
    sourceCode,
};

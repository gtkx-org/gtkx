import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkPaned } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./panes.tsx?raw";

/**
 * Paned Widgets demo matching the official GTK gtk-demo.
 * Shows nested horizontal and vertical panes with simple labels.
 */
const PanesDemo = () => (
    <GtkBox
        name="panes-root"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        marginStart={8}
        marginEnd={8}
        marginTop={8}
        marginBottom={8}
    >
        <GtkFrame name="panes-frame">
            <GtkPaned
                name="panes-outer"
                orientation={Gtk.Orientation.VERTICAL}
                shrinkStartChild={false}
                shrinkEndChild={false}
                startChild={
                    <GtkPaned
                        name="panes-inner"
                        shrinkStartChild={false}
                        shrinkEndChild={false}
                        startChild={
                            <GtkLabel
                                label="Hi there"
                                marginStart={4}
                                marginEnd={4}
                                marginTop={4}
                                marginBottom={4}
                                hexpand
                                vexpand
                            />
                        }
                        endChild={
                            <GtkLabel
                                label="Hello"
                                marginStart={4}
                                marginEnd={4}
                                marginTop={4}
                                marginBottom={4}
                                hexpand
                                vexpand
                            />
                        }
                    />
                }
                endChild={
                    <GtkLabel
                        label="Goodbye"
                        marginStart={4}
                        marginEnd={4}
                        marginTop={4}
                        marginBottom={4}
                        hexpand
                        vexpand
                    />
                }
            />
        </GtkFrame>
    </GtkBox>
);

export const panesDemo: Demo = {
    id: "panes",
    title: "Paned Widgets",
    description:
        "The GtkPaned Widget divides its content area into two panes with a divider in between that the user can adjust. A separate child is placed into each pane. GtkPaned widgets can be split horizontally or vertically. This test contains both a horizontal and a vertical GtkPaned widget.\n\nThere are a number of options that can be set for each pane. You can use the Inspector to adjust the options for each side of each widget.",
    keywords: [],
    component: PanesDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 250,
    resizable: false,
};

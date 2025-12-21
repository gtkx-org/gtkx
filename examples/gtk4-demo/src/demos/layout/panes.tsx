import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkPaned, GtkScrolledWindow, Slot } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PanesDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Paned Container" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Horizontal Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel label="Drag the handle between panes to resize them." wrap cssClasses={["dim-label"]} />
                <GtkPaned
                    orientation={Gtk.Orientation.HORIZONTAL}
                    wideHandle
                    heightRequest={150}
                    position={200}
                    cssClasses={["card"]}
                >
                    <Slot for={GtkPaned} id="startChild">
                        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                                <GtkLabel label="Left Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This is the start child of the paned container."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </GtkScrolledWindow>
                    </Slot>
                    <Slot for={GtkPaned} id="endChild">
                        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                                <GtkLabel label="Right Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This is the end child of the paned container."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </GtkScrolledWindow>
                    </Slot>
                </GtkPaned>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Vertical Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkPaned
                    orientation={Gtk.Orientation.VERTICAL}
                    wideHandle
                    heightRequest={200}
                    position={80}
                    cssClasses={["card"]}
                >
                    <Slot for={GtkPaned} id="startChild">
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                            <GtkLabel label="Top Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </GtkBox>
                    </Slot>
                    <Slot for={GtkPaned} id="endChild">
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                            <GtkLabel label="Bottom Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </GtkBox>
                    </Slot>
                </GtkPaned>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Nested Panes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkPaned
                    orientation={Gtk.Orientation.HORIZONTAL}
                    wideHandle
                    heightRequest={200}
                    position={150}
                    cssClasses={["card"]}
                >
                    <Slot for={GtkPaned} id="startChild">
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={12} marginTop={12}>
                            <GtkLabel label="Sidebar" cssClasses={["heading"]} />
                        </GtkBox>
                    </Slot>
                    <Slot for={GtkPaned} id="endChild">
                        <GtkPaned orientation={Gtk.Orientation.VERTICAL} wideHandle position={100}>
                            <Slot for={GtkPaned} id="startChild">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={0}
                                    marginStart={12}
                                    marginTop={12}
                                >
                                    <GtkLabel label="Main Content" cssClasses={["heading"]} />
                                </GtkBox>
                            </Slot>
                            <Slot for={GtkPaned} id="endChild">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={0}
                                    marginStart={12}
                                    marginTop={12}
                                >
                                    <GtkLabel label="Details Panel" cssClasses={["heading"]} />
                                </GtkBox>
                            </Slot>
                        </GtkPaned>
                    </Slot>
                </GtkPaned>
            </GtkBox>
        </GtkBox>
    );
};

export const panesDemo: Demo = {
    id: "panes",
    title: "Panes",
    description: "Resizable split container with draggable divider.",
    keywords: ["paned", "split", "resize", "divider", "GtkPaned"],
    component: PanesDemo,
    sourcePath: getSourcePath(import.meta.url, "panes.tsx"),
};

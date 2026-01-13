import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPaned, GtkScrolledWindow, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paned.tsx?raw";

const PanedDemo = () => {
    const [position, setPosition] = useState(200);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Paned Container" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Horizontal Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Drag the handle between panes to resize them. Uses Slot for startChild and endChild."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkPaned wideHandle heightRequest={150} position={position} cssClasses={["card"]}>
                    <x.Slot for={GtkPaned} id="startChild">
                        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkLabel label="Left Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This is the start child of the paned container. Resize by dragging the handle."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </GtkScrolledWindow>
                    </x.Slot>
                    <x.Slot for={GtkPaned} id="endChild">
                        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkLabel label="Right Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This is the end child of the paned container."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </GtkScrolledWindow>
                    </x.Slot>
                </GtkPaned>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Vertical Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Orientation can be vertical for top/bottom split."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkPaned
                    orientation={Gtk.Orientation.VERTICAL}
                    wideHandle
                    heightRequest={200}
                    position={80}
                    cssClasses={["card"]}
                >
                    <x.Slot for={GtkPaned} id="startChild">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                        >
                            <GtkLabel label="Top Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </GtkBox>
                    </x.Slot>
                    <x.Slot for={GtkPaned} id="endChild">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                        >
                            <GtkLabel label="Bottom Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </GtkBox>
                    </x.Slot>
                </GtkPaned>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Nested Panes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Panes can be nested to create complex layouts like IDE interfaces."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkPaned wideHandle heightRequest={200} position={150} cssClasses={["card"]}>
                    <x.Slot for={GtkPaned} id="startChild">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                        >
                            <GtkLabel label="Sidebar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                            <GtkButton label="Item 1" cssClasses={["flat"]} />
                            <GtkButton label="Item 2" cssClasses={["flat"]} />
                            <GtkButton label="Item 3" cssClasses={["flat"]} />
                        </GtkBox>
                    </x.Slot>
                    <x.Slot for={GtkPaned} id="endChild">
                        <GtkPaned orientation={Gtk.Orientation.VERTICAL} wideHandle position={100}>
                            <x.Slot for={GtkPaned} id="startChild">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    marginStart={12}
                                    marginEnd={12}
                                    marginTop={12}
                                >
                                    <GtkLabel label="Main Content" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                    <GtkLabel label="Editor or content area" cssClasses={["dim-label"]} />
                                </GtkBox>
                            </x.Slot>
                            <x.Slot for={GtkPaned} id="endChild">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    marginStart={12}
                                    marginEnd={12}
                                    marginTop={12}
                                >
                                    <GtkLabel label="Details Panel" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                    <GtkLabel label="Properties or terminal" cssClasses={["dim-label"]} />
                                </GtkBox>
                            </x.Slot>
                        </GtkPaned>
                    </x.Slot>
                </GtkPaned>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Controlled Position" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="The divider position can be controlled programmatically."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8}>
                    <GtkButton label="25%" onClicked={() => setPosition(100)} />
                    <GtkButton label="50%" onClicked={() => setPosition(200)} />
                    <GtkButton label="75%" onClicked={() => setPosition(300)} />
                </GtkBox>
                <GtkLabel label={`Current position: ${position}px`} cssClasses={["dim-label"]} />
            </GtkBox>
        </GtkBox>
    );
};

export const panedDemo: Demo = {
    id: "paned",
    title: "Paned",
    description: "Resizable split container with draggable divider.",
    keywords: ["paned", "split", "resize", "divider", "sidebar", "GtkPaned"],
    component: PanedDemo,
    sourceCode,
};

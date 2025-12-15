import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Paned, ScrolledWindow } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PanesDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Paned Container" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Horizontal Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label label="Drag the handle between panes to resize them." wrap cssClasses={["dim-label"]} />
                <Paned.Root
                    orientation={Gtk.Orientation.HORIZONTAL}
                    wideHandle
                    heightRequest={150}
                    position={200}
                    cssClasses={["card"]}
                >
                    <Paned.StartChild>
                        <ScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                                <Label label="Left Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <Label
                                    label="This is the start child of the paned container."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </Box>
                        </ScrolledWindow>
                    </Paned.StartChild>
                    <Paned.EndChild>
                        <ScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                                <Label label="Right Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                                <Label
                                    label="This is the end child of the paned container."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </Box>
                        </ScrolledWindow>
                    </Paned.EndChild>
                </Paned.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Vertical Paned" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Paned.Root
                    orientation={Gtk.Orientation.VERTICAL}
                    wideHandle
                    heightRequest={200}
                    position={80}
                    cssClasses={["card"]}
                >
                    <Paned.StartChild>
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                            <Label label="Top Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </Box>
                    </Paned.StartChild>
                    <Paned.EndChild>
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginStart={12} marginTop={12}>
                            <Label label="Bottom Pane" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        </Box>
                    </Paned.EndChild>
                </Paned.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Nested Panes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Paned.Root
                    orientation={Gtk.Orientation.HORIZONTAL}
                    wideHandle
                    heightRequest={200}
                    position={150}
                    cssClasses={["card"]}
                >
                    <Paned.StartChild>
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={12} marginTop={12}>
                            <Label label="Sidebar" cssClasses={["heading"]} />
                        </Box>
                    </Paned.StartChild>
                    <Paned.EndChild>
                        <Paned.Root orientation={Gtk.Orientation.VERTICAL} wideHandle position={100}>
                            <Paned.StartChild>
                                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={12} marginTop={12}>
                                    <Label label="Main Content" cssClasses={["heading"]} />
                                </Box>
                            </Paned.StartChild>
                            <Paned.EndChild>
                                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={12} marginTop={12}>
                                    <Label label="Details Panel" cssClasses={["heading"]} />
                                </Box>
                            </Paned.EndChild>
                        </Paned.Root>
                    </Paned.EndChild>
                </Paned.Root>
            </Box>
        </Box>
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

import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const FramesDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame.Root label="Section Title">
                    <GtkFrame.Child>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            This content is inside a frame.
                            <GtkLabel
                                label="Frames provide visual grouping with an optional label."
                                cssClasses={["dim-label"]}
                                wrap
                            />
                        </GtkBox>
                    </GtkFrame.Child>
                </GtkFrame.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Frame without GtkLabel" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame.Root>
                    <GtkFrame.Child>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkLabel label="Frames can also be used without a label." wrap />
                            <GtkLabel
                                label="They still provide visual grouping and a border."
                                cssClasses={["dim-label"]}
                                wrap
                            />
                        </GtkBox>
                    </GtkFrame.Child>
                </GtkFrame.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Custom <GtkLabel Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame.Root>
                    <GtkFrame.LabelWidget>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <GtkLabel label="Custom Header" cssClasses={["heading"]} />
                            <GtkButton label="Action" cssClasses={["flat", "small"]} />
                        </GtkBox>
                    </GtkFrame.LabelWidget>
                    <GtkFrame.Child>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkLabel label="You can use any widget as the frame label." wrap />
                            <GtkLabel label="This allows for interactive headers." cssClasses={["dim-label"]} wrap />
                        </GtkBox>
                    </GtkFrame.Child>
                </GtkFrame.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Multiple Frames" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkFrame.Root label="Option A" hexpand>
                        <GtkFrame.Child>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkButton label="Select A" hexpand />
                            </GtkBox>
                        </GtkFrame.Child>
                    </GtkFrame.Root>
                    <GtkFrame.Root label="Option B" hexpand>
                        <GtkFrame.Child>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkButton label="Select B" hexpand />
                            </GtkBox>
                        </GtkFrame.Child>
                    </GtkFrame.Root>
                    <GtkFrame.Root label="Option C" hexpand>
                        <GtkFrame.Child>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkButton label="Select C" hexpand />
                            </GtkBox>
                        </GtkFrame.Child>
                    </GtkFrame.Root>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Frames",
    description: "Decorative container with optional label for grouping widgets.",
    keywords: ["frame", "border", "group", "container", "GtkFrame"],
    component: FramesDemo,
    sourcePath: getSourcePath(import.meta.url, "frames.tsx"),
};

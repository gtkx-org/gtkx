import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, Slot } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const FramesDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame label="Section Title">
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
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Frame without GtkLabel" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame>
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
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Custom <GtkLabel Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame>
                    <Slot for={GtkFrame} id="labelWidget">
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <GtkLabel label="Custom Header" cssClasses={["heading"]} />
                            <GtkButton label="Action" cssClasses={["flat", "small"]} />
                        </GtkBox>
                    </Slot>
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
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Multiple Frames" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkFrame label="Option A" hexpand>
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
                    </GtkFrame>
                    <GtkFrame label="Option B" hexpand>
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
                    </GtkFrame>
                    <GtkFrame label="Option C" hexpand>
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
                    </GtkFrame>
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

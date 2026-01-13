import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkFrame, GtkLabel, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./frames.tsx?raw";

const FramesDemo = () => {
    const [expanded, setExpanded] = useState(true);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Basic Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFrame provides visual grouping with an optional label."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkFrame label="Section Title">
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginStart={12}
                        marginEnd={12}
                        marginTop={12}
                        marginBottom={12}
                    >
                        <GtkLabel label="This content is inside a frame." halign={Gtk.Align.START} />
                        <GtkLabel
                            label="Frames provide visual grouping with an optional label at the top."
                            cssClasses={["dim-label"]}
                            wrap
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Frame without Label" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Frames can be used without a label for simple visual grouping."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkFrame>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginStart={12}
                        marginEnd={12}
                        marginTop={12}
                        marginBottom={12}
                    >
                        <GtkLabel label="Frame without a label." halign={Gtk.Align.START} />
                        <GtkLabel
                            label="The frame still provides visual grouping and a border."
                            cssClasses={["dim-label"]}
                            wrap
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Custom Label Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use the labelWidget slot to provide a custom header with any widget."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkFrame>
                    <x.Slot for={GtkFrame} id="labelWidget">
                        <GtkBox spacing={8}>
                            <GtkLabel label="Settings" cssClasses={["heading"]} />
                            <GtkButton label="Reset" cssClasses={["flat", "small"]} />
                        </GtkBox>
                    </x.Slot>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginStart={12}
                        marginEnd={12}
                        marginTop={12}
                        marginBottom={12}
                    >
                        <GtkLabel label="You can use any widget as the frame label." halign={Gtk.Align.START} />
                        <GtkLabel
                            label="This allows for interactive headers with buttons or other controls."
                            cssClasses={["dim-label"]}
                            wrap
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Interactive Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Frames can contain interactive content."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkFrame>
                    <x.Slot for={GtkFrame} id="labelWidget">
                        <GtkCheckButton
                            label="Show Content"
                            active={expanded}
                            onToggled={() => setExpanded(!expanded)}
                        />
                    </x.Slot>
                    {expanded && (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkLabel label="This content can be toggled." halign={Gtk.Align.START} />
                            <GtkLabel
                                label="Click the checkbox in the header to hide this section."
                                cssClasses={["dim-label"]}
                                wrap
                                halign={Gtk.Align.START}
                            />
                        </GtkBox>
                    )}
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Multiple Frames" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use multiple frames to organize content into sections."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={12}>
                    <GtkFrame label="Option A" hexpand>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
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
                            spacing={8}
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
                            spacing={8}
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
    keywords: ["frame", "border", "group", "container", "section", "GtkFrame"],
    component: FramesDemo,
    sourceCode,
};

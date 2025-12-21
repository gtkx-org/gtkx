import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCenterBox, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const CenterBoxDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Center GtkBox" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Horizontal CenterBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkCenterBox has three slots: start, center, and end. The center widget is always centered."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkCenterBox.Root hexpand cssClasses={["card"]} marginTop={8} marginBottom={8}>
                    <GtkCenterBox.StartWidget>
                        <GtkButton label="Start" marginStart={8} />
                    </GtkCenterBox.StartWidget>
                    <GtkCenterBox.CenterWidget>
                        <GtkLabel label="Center" cssClasses={["heading"]} />
                    </GtkCenterBox.CenterWidget>
                    <GtkCenterBox.EndWidget>
                        <GtkButton label="End" marginEnd={8} />
                    </GtkCenterBox.EndWidget>
                </GtkCenterBox.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Toolbar Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkCenterBox.Root hexpand cssClasses={["toolbar"]}>
                    <GtkCenterBox.StartWidget>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6} marginStart={6}>
                            <GtkButton label="Back" cssClasses={["flat"]} />
                            <GtkButton label="Forward" cssClasses={["flat"]} />
                        </GtkBox>
                    </GtkCenterBox.StartWidget>
                    <GtkCenterBox.CenterWidget>
                        <GtkLabel label="Document.txt" cssClasses={["title-4"]} />
                    </GtkCenterBox.CenterWidget>
                    <GtkCenterBox.EndWidget>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6} marginEnd={6}>
                            <GtkButton label="Share" cssClasses={["flat"]} />
                            <GtkButton label="Menu" cssClasses={["flat"]} />
                        </GtkBox>
                    </GtkCenterBox.EndWidget>
                </GtkCenterBox.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Vertical CenterBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkCenterBox.Root
                    orientation={Gtk.Orientation.VERTICAL}
                    vexpand
                    heightRequest={200}
                    cssClasses={["card"]}
                >
                    <GtkCenterBox.StartWidget>
                        <GtkLabel label="Top" marginTop={12} />
                    </GtkCenterBox.StartWidget>
                    <GtkCenterBox.CenterWidget>
                        <GtkButton label="Centered Content" cssClasses={["suggested-action"]} />
                    </GtkCenterBox.CenterWidget>
                    <GtkCenterBox.EndWidget>
                        <GtkLabel label="Bottom" marginBottom={12} />
                    </GtkCenterBox.EndWidget>
                </GtkCenterBox.Root>
            </GtkBox>
        </GtkBox>
    );
};

export const centerBoxDemo: Demo = {
    id: "center-box",
    title: "Center GtkBox",
    description: "Three-slot container with start, center, and end positions.",
    keywords: ["center", "box", "layout", "slots", "GtkCenterBox"],
    component: CenterBoxDemo,
    sourcePath: getSourcePath(import.meta.url, "center-box.tsx"),
};

import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const BoxDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="GtkBox Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Horizontal GtkBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkButton label="First" />
                    <GtkButton label="Second" />
                    <GtkButton label="Third" />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Vertical GtkBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkButton label="Top" />
                    <GtkButton label="Middle" />
                    <GtkButton label="Bottom" />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Expand and Fill" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkButton label="Fixed" />
                    <GtkButton label="Expand" hexpand />
                    <GtkButton label="Fixed" />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Alignment" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                    heightRequest={80}
                >
                    <GtkButton label="Start" valign={Gtk.Align.START} />
                    <GtkButton label="Center" valign={Gtk.Align.CENTER} />
                    <GtkButton label="End" valign={Gtk.Align.END} />
                    <GtkButton label="Fill" valign={Gtk.Align.FILL} vexpand />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Homogeneous" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="When homogeneous is true, all children get the same size."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    homogeneous
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <GtkButton label="Short" />
                    <GtkButton label="Medium Text" />
                    <GtkButton label="Longer <GtkButton Text" />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const boxDemo: Demo = {
    id: "box",
    title: "GtkBox",
    description: "Linear container for arranging widgets horizontally or vertically.",
    keywords: ["box", "layout", "container", "horizontal", "vertical", "GtkBox"],
    component: BoxDemo,
    sourcePath: getSourcePath(import.meta.url, "box.tsx"),
};

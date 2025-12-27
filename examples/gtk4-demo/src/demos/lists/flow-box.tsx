import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFlowBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const colors = [
    "#e01b24",
    "#ff7800",
    "#f5c211",
    "#33d17a",
    "#3584e4",
    "#9141ac",
    "#c64600",
    "#986a44",
    "#5e5c64",
    "#77767b",
    "#c0bfbc",
    "#f66151",
    "#ffbe6f",
    "#f9f06b",
    "#8ff0a4",
    "#99c1f1",
    "#dc8add",
    "#e66100",
    "#cdab8f",
    "#9a9996",
];

const colorBox = (color: string) => css`
    background: ${color};
    border-radius: 4px;
`;

const FlowBoxDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Flow GtkBox" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About FlowBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFlowBox is a container that positions child widgets in sequence according to its orientation. It reflows children when the container size changes."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Color Palette" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Resize the window to see the colors reflow. <GtkFlowBox automatically adjusts the layout based on available space."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkScrolledWindow heightRequest={200} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkFlowBox
                        selectionMode={Gtk.SelectionMode.SINGLE}
                        maxChildrenPerLine={10}
                        minChildrenPerLine={3}
                        columnSpacing={8}
                        rowSpacing={8}
                        homogeneous
                    >
                        {colors.map((color, index) => (
                            <GtkBox

                                key={index}
                                orientation={Gtk.Orientation.HORIZONTAL}
                                spacing={0}
                                widthRequest={100}
                                heightRequest={80}
                                cssClasses={[colorBox(color)]}
                            />
                        ))}
                    </GtkFlowBox>
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFlowBox properties include: min/max-children-per-line, column-spacing, row-spacing, homogeneous, and selection-mode."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const flowBoxDemo: Demo = {
    id: "flowbox",
    title: "Flow GtkBox",
    description: "Container that reflows children based on available space.",
    keywords: ["flowbox", "flow", "grid", "wrap", "GtkFlowBox"],
    component: FlowBoxDemo,
    sourcePath: getSourcePath(import.meta.url, "flow-box.tsx"),
};

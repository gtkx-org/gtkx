import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFlowBox, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./flowbox.tsx?raw";

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

const colorData = colors.map((color) => ({
    color,
    style: css`background-color: ${color}; border-radius: 8px;`,
}));

const FlowBoxDemo = () => {
    const [itemCount, setItemCount] = useState(12);

    const items = Array.from({ length: itemCount }, (_, i) => i + 1);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="FlowBox" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About FlowBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkFlowBox positions child widgets in sequence according to its orientation. It reflows children when the container size changes, similar to CSS flexbox with wrap."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Color Palette" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Resize the window to see the colors reflow. FlowBox automatically adjusts layout based on available space."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkScrolledWindow heightRequest={240} hscrollbarPolicy={Gtk.PolicyType.NEVER} cssClasses={["card"]}>
                    <GtkFlowBox
                        maxChildrenPerLine={10}
                        minChildrenPerLine={3}
                        columnSpacing={8}
                        rowSpacing={8}
                        homogeneous
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {colorData.map(({ color, style }) => (
                            <GtkBox key={color} widthRequest={80} heightRequest={60} cssClasses={["card", style]} />
                        ))}
                    </GtkFlowBox>
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Dynamic Items" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Add or remove items to see how FlowBox adapts."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8}>
                    <GtkButton
                        label="Add Item"
                        onClicked={() => setItemCount(Math.min(itemCount + 1, 20))}
                        cssClasses={["suggested-action"]}
                    />
                    <GtkButton
                        label="Remove Item"
                        onClicked={() => setItemCount(Math.max(itemCount - 1, 0))}
                        cssClasses={["destructive-action"]}
                    />
                    <GtkLabel label={`${itemCount} items`} cssClasses={["dim-label"]} valign={Gtk.Align.CENTER} />
                </GtkBox>
                <GtkScrolledWindow heightRequest={180} hscrollbarPolicy={Gtk.PolicyType.NEVER} cssClasses={["card"]}>
                    <GtkFlowBox
                        columnSpacing={8}
                        rowSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {items.map((item) => (
                            <GtkButton key={item} label={`Item ${item}`} />
                        ))}
                    </GtkFlowBox>
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Selection Mode" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="FlowBox supports different selection modes: NONE, SINGLE, BROWSE, and MULTIPLE."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]}>
                    <GtkFlowBox
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        columnSpacing={8}
                        rowSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel
                            label="Selectable 1"
                            cssClasses={["card"]}
                            marginStart={8}
                            marginEnd={8}
                            marginTop={4}
                            marginBottom={4}
                        />
                        <GtkLabel
                            label="Selectable 2"
                            cssClasses={["card"]}
                            marginStart={8}
                            marginEnd={8}
                            marginTop={4}
                            marginBottom={4}
                        />
                        <GtkLabel
                            label="Selectable 3"
                            cssClasses={["card"]}
                            marginStart={8}
                            marginEnd={8}
                            marginTop={4}
                            marginBottom={4}
                        />
                        <GtkLabel
                            label="Selectable 4"
                            cssClasses={["card"]}
                            marginStart={8}
                            marginEnd={8}
                            marginTop={4}
                            marginBottom={4}
                        />
                        <GtkLabel
                            label="Selectable 5"
                            cssClasses={["card"]}
                            marginStart={8}
                            marginEnd={8}
                            marginTop={4}
                            marginBottom={4}
                        />
                    </GtkFlowBox>
                </GtkBox>
                <GtkLabel
                    label="Click items above to select them (MULTIPLE mode allows Ctrl+click)."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="minChildrenPerLine: Minimum items before wrapping. maxChildrenPerLine: Maximum items per line. homogeneous: All children get the same size. columnSpacing/rowSpacing: Gap between items."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const flowboxDemo: Demo = {
    id: "flowbox",
    title: "Flow Box",
    description:
        "GtkFlowBox allows flexible and responsive grids which reflow as needed and support sorting and filtering. The children of a GtkFlowBox are regular widgets.",
    keywords: ["flowbox", "flow", "grid", "wrap", "responsive", "GtkFlowBox"],
    component: FlowBoxDemo,
    sourceCode,
};

import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFlowBox, GtkScrolledWindow } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./flowbox.tsx?raw";

const COLORS = [
    "AliceBlue",
    "AntiqueWhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "BlanchedAlmond",
    "blue",
    "BlueViolet",
    "brown",
    "burlywood",
    "CadetBlue",
    "chartreuse",
    "chocolate",
    "coral",
    "CornflowerBlue",
    "cornsilk",
    "crimson",
    "cyan",
    "DarkBlue",
    "DarkCyan",
    "DarkGoldenrod",
    "DarkGray",
    "DarkGreen",
    "DarkKhaki",
    "DarkMagenta",
    "DarkOliveGreen",
    "DarkOrange",
    "DarkOrchid",
    "DarkRed",
    "DarkSalmon",
    "DarkSeaGreen",
    "DarkSlateBlue",
    "DarkSlateGray",
    "DarkTurquoise",
    "DarkViolet",
    "DeepPink",
    "DeepSkyBlue",
    "DimGray",
    "DodgerBlue",
    "firebrick",
    "FloralWhite",
    "ForestGreen",
    "fuchsia",
    "gainsboro",
    "GhostWhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "GreenYellow",
    "honeydew",
    "HotPink",
    "IndianRed",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "LavenderBlush",
    "LawnGreen",
    "LemonChiffon",
    "LightBlue",
    "LightCoral",
    "LightCyan",
    "LightGoldenrodYellow",
    "LightGray",
    "LightGreen",
    "LightPink",
    "LightSalmon",
    "LightSeaGreen",
    "LightSkyBlue",
    "LightSlateGray",
    "LightSteelBlue",
    "LightYellow",
    "lime",
    "LimeGreen",
    "linen",
    "magenta",
    "maroon",
    "MediumAquamarine",
    "MediumBlue",
    "MediumOrchid",
    "MediumPurple",
    "MediumSeaGreen",
    "MediumSlateBlue",
    "MediumSpringGreen",
    "MediumTurquoise",
    "MediumVioletRed",
    "MidnightBlue",
    "MintCream",
    "MistyRose",
    "moccasin",
    "NavajoWhite",
    "navy",
    "OldLace",
    "olive",
    "OliveDrab",
    "orange",
    "OrangeRed",
    "orchid",
    "PaleGoldenrod",
    "PaleGreen",
    "PaleTurquoise",
    "PaleVioletRed",
    "PapayaWhip",
    "PeachPuff",
    "peru",
    "pink",
    "plum",
    "PowderBlue",
    "purple",
    "red",
    "RosyBrown",
    "RoyalBlue",
    "SaddleBrown",
    "salmon",
    "SandyBrown",
    "SeaGreen",
    "seashell",
    "sienna",
    "silver",
    "SkyBlue",
    "SlateBlue",
    "SlateGray",
    "snow",
    "SpringGreen",
    "SteelBlue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "WhiteSmoke",
    "yellow",
    "YellowGreen",
];

const colorStyles = COLORS.map(
    (color) => css`
        & {
            background-color: ${color};
        }
    `,
);

/**
 * Flow Box demo matching the official GTK gtk-demo.
 * GtkFlowBox allows flexible and responsive grids which reflow
 * as needed and support sorting and filtering.
 */
const FlowBoxDemo = () => {
    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <GtkFlowBox
                maxChildrenPerLine={30}
                selectionMode={Gtk.SelectionMode.NONE}
                valign={Gtk.Align.START}
            >
                {COLORS.map((color, index) => (
                    <GtkButton key={color}>
                        <GtkBox widthRequest={24} heightRequest={24} cssClasses={[colorStyles[index] ?? ""]} />
                    </GtkButton>
                ))}
            </GtkFlowBox>
        </GtkScrolledWindow>
    );
};

export const flowboxDemo: Demo = {
    id: "flowbox",
    title: "Flow Box",
    description:
        "GtkFlowBox allows flexible and responsive grids which reflow as needed and support sorting and filtering. The children of a GtkFlowBox are regular widgets.",
    keywords: ["flowbox", "GtkFlowBox", "grid", "wrap", "responsive"],
    component: FlowBoxDemo,
    sourceCode,
};

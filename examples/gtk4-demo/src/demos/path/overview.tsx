import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PathOverviewDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Path" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About GskPath" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GskPath is GTK4's modern vector path API. It provides efficient path construction, manipulation, and rendering for 2D graphics. Paths are immutable and can be reused efficiently."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Path Building" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`GskPathBuilder provides methods for constructing paths:
• moveTo(x, y) - Start a new contour
• lineTo(x, y) - Draw straight lines
• curveTo() - Cubic Bezier curves
• quadTo() - Quadratic Bezier curves
• arcTo() - Circular and elliptical arcs
• close() - Close the current contour`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Predefined Shapes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• addRect() - Rectangles
• addCircle() - Circles
• addRoundedRect() - Rounded rectangles
• addPath() - Combine paths
• addLayout() - Text paths from Pango`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Path Operations" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• GskPathMeasure - Path length and sampling
• GskPathPoint - Points on paths
• Path parsing from SVG path strings
• Stroke and fill operations via GskStroke`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GskPath, GskPathBuilder, GskPathMeasure, and GskPathPoint FFI bindings are available. Paths can be constructed and rendered using GtkSnapshot's append_stroke and append_fill methods."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const pathOverviewDemo: Demo = {
    id: "path-overview",
    title: "Path Overview",
    description: "Vector path creation and manipulation with GskPath.",
    keywords: ["path", "gsk", "vector", "bezier", "curves", "graphics"],
    component: PathOverviewDemo,
    sourcePath: getSourcePath(import.meta.url, "overview.tsx"),
};

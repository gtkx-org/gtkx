import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const DrawingOverviewDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drawing" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Drawing" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK's drawing system uses Cairo for 2D vector graphics and GtkSnapshot for GPU-accelerated rendering. GtkDrawingArea provides a canvas widget for custom rendering."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Drawing APIs" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• Cairo - 2D vector graphics (lines, curves, text, images)
• GtkSnapshot - Modern GPU-accelerated rendering
• GtkDrawingArea - Canvas widget with setDrawFunc callback
• GskPath - Vector path construction and rendering`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Cairo Operations" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• Path construction (moveTo, lineTo, curveTo, arc)
• Stroke and fill with colors/patterns
• Text rendering with Pango integration
• Transformations (translate, scale, rotate)
• Clipping and masking`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkDrawingArea and Cairo context bindings are available. The setDrawFunc method can be called to register a draw callback. Full Cairo drawing method bindings are in development."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Alternative Approaches" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`For many use cases, you can achieve great visuals using:
• CSS-in-JS with @gtkx/css for gradients and shadows
• <GtkImage widgets for static graphics
• Combining standard widgets creatively
• Games can use Grid layouts with styled GtkButtons`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const drawingOverviewDemo: Demo = {
    id: "drawing-overview",
    title: "Drawing Overview",
    description: "Custom 2D graphics with Cairo and GtkSnapshot.",
    keywords: ["drawing", "cairo", "graphics", "canvas", "vector"],
    component: DrawingOverviewDemo,
    sourcePath: getSourcePath(import.meta.url, "overview.tsx"),
};

import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/gtkx";
import type { Demo } from "../types.js";

export const DrawingOverviewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Drawing" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Drawing" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GTK's drawing system uses Cairo for 2D vector graphics and GtkSnapshot for GPU-accelerated rendering. GtkDrawingArea provides a canvas widget for custom rendering."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Drawing APIs" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• Cairo - 2D vector graphics (lines, curves, text, images)\n• GtkSnapshot - Modern GPU-accelerated rendering\n• GtkDrawingArea - Canvas widget with setDrawFunc callback\n• GskPath - Vector path construction and rendering"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Cairo Operations" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• Path construction (moveTo, lineTo, curveTo, arc)\n• Stroke and fill with colors/patterns\n• Text rendering with Pango integration\n• Transformations (translate, scale, rotate)\n• Clipping and masking"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkDrawingArea and Cairo context bindings are available. The setDrawFunc method can be called to register a draw callback. Full Cairo drawing method bindings are in development."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Alternative Approaches" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="For many use cases, you can achieve great visuals using:\n• CSS-in-JS with @gtkx/css for gradients and shadows\n• Image widgets for static graphics\n• Combining standard widgets creatively\n• Games can use Grid layouts with styled Buttons"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const drawingOverviewDemo: Demo = {
    id: "drawing-overview",
    title: "Drawing Overview",
    description: "Custom 2D graphics with Cairo and GtkSnapshot.",
    keywords: ["drawing", "cairo", "graphics", "canvas", "vector"],
    component: DrawingOverviewDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";

// GtkDrawingArea is available for custom drawing
// The draw function receives a Cairo context

// Example using the FFI directly:
const drawingArea = new Gtk.DrawingArea();
drawingArea.setContentWidth(400);
drawingArea.setContentHeight(300);

// Set the draw function (Cairo context passed to callback)
drawingArea.setDrawFunc(null, (area, cr, width, height) => {
    // Cairo drawing operations:
    // cr.setSourceRgb(1.0, 0, 0);  // Red
    // cr.rectangle(10, 10, 100, 50);
    // cr.fill();
});

// For Print operations, Cairo context is available:
printOp.connect("draw-page", (context, pageNr) => {
    const cr = context.getCairoContext();
    const width = context.getWidth();
    const height = context.getHeight();
    // Draw page content with Cairo...
});`,
};

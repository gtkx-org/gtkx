import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/gtkx";
import type { Demo } from "../types.js";

export const PathOverviewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Path" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About GskPath" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GskPath is GTK4's modern vector path API. It provides efficient path construction, manipulation, and rendering for 2D graphics. Paths are immutable and can be reused efficiently."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Path Building" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GskPathBuilder provides methods for constructing paths:\n• moveTo(x, y) - Start a new contour\n• lineTo(x, y) - Draw straight lines\n• curveTo() - Cubic Bezier curves\n• quadTo() - Quadratic Bezier curves\n• arcTo() - Circular and elliptical arcs\n• close() - Close the current contour"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Predefined Shapes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• addRect() - Rectangles\n• addCircle() - Circles\n• addRoundedRect() - Rounded rectangles\n• addPath() - Combine paths\n• addLayout() - Text paths from Pango"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Path Operations" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• GskPathMeasure - Path length and sampling\n• GskPathPoint - Points on paths\n• Path parsing from SVG path strings\n• Stroke and fill operations via GskStroke"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GskPath, GskPathBuilder, GskPathMeasure, and GskPathPoint FFI bindings are available. Paths can be constructed and rendered using GtkSnapshot's append_stroke and append_fill methods."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const pathOverviewDemo: Demo = {
    id: "path-overview",
    title: "Path Overview",
    description: "Vector path creation and manipulation with GskPath.",
    keywords: ["path", "gsk", "vector", "bezier", "curves", "graphics"],
    component: PathOverviewDemo,
    source: `import * as Gsk from "@gtkx/ffi/gsk";

// GskPathBuilder for constructing paths
const builder = new Gsk.PathBuilder();

// Build a star shape
builder.moveTo(100, 0);
builder.lineTo(120, 70);
builder.lineTo(190, 70);
builder.lineTo(135, 115);
builder.lineTo(155, 185);
builder.lineTo(100, 145);
builder.lineTo(45, 185);
builder.lineTo(65, 115);
builder.lineTo(10, 70);
builder.lineTo(80, 70);
builder.close();

// Get the immutable path
const path = builder.freeToPaths();

// Predefined shapes
const circleBuilder = new Gsk.PathBuilder();
circleBuilder.addCircle(new Graphene.Point({ x: 50, y: 50 }), 25);

// Parse SVG path string
const svgPath = Gsk.Path.parse("M 0 0 L 100 0 L 100 100 Z");

// Measure path
const measure = new Gsk.PathMeasure(path);
const length = measure.getLength();`,
};

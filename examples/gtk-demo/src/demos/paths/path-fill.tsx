import { type Context, FillRule, Pattern, PdfSurface } from "@gtkx/ffi/cairo";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-fill.tsx?raw";

const drawSolidFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.4;

    cr.save()
        .translate(centerX, centerY)
        .moveTo(0, -size * 0.3)
        .curveTo(-size * 0.8, -size, -size * 0.8, size * 0.2, 0, size * 0.6)
        .curveTo(size * 0.8, size * 0.2, size * 0.8, -size, 0, -size * 0.3)
        .closePath();

    cr.setSourceRgb(0.9, 0.2, 0.3).fillPreserve();

    cr.setSourceRgb(0.7, 0.1, 0.2).setLineWidth(3).stroke().restore();
};

const drawLinearGradient = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const padding = 20;
    const rectWidth = width - padding * 2;
    const rectHeight = height - padding * 2;

    const gradient = Pattern.createLinear(padding, padding, padding + rectWidth, padding + rectHeight)
        .addColorStopRgb(0, 0.2, 0.4, 0.8)
        .addColorStopRgb(0.5, 0.5, 0.2, 0.7)
        .addColorStopRgb(1, 0.9, 0.3, 0.5);

    const radius = 20;
    cr.moveTo(padding + radius, padding)
        .lineTo(padding + rectWidth - radius, padding)
        .arc(padding + rectWidth - radius, padding + radius, radius, -Math.PI / 2, 0)
        .lineTo(padding + rectWidth, padding + rectHeight - radius)
        .arc(padding + rectWidth - radius, padding + rectHeight - radius, radius, 0, Math.PI / 2)
        .lineTo(padding + radius, padding + rectHeight)
        .arc(padding + radius, padding + rectHeight - radius, radius, Math.PI / 2, Math.PI)
        .lineTo(padding, padding + radius)
        .arc(padding + radius, padding + radius, radius, Math.PI, (3 * Math.PI) / 2)
        .closePath()
        .setSource(gradient)
        .fill();
};

const drawRadialGradient = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    const gradient = Pattern.createRadial(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius,
    )
        .addColorStopRgb(0, 1, 1, 0.8)
        .addColorStopRgb(0.5, 0.9, 0.6, 0.1)
        .addColorStopRgb(1, 0.8, 0.3, 0);

    cr.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .setSource(gradient)
        .fill();
};

const drawEvenOddFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.5;

    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);

    cr.newSubPath().arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);

    cr.setFillRule(FillRule.EVEN_ODD)
        .setSourceRgb(0.3, 0.6, 0.9)
        .fillPreserve()
        .setSourceRgb(0.1, 0.3, 0.6)
        .setLineWidth(2)
        .stroke();

    cr.setFillRule(FillRule.WINDING);
};

const drawWindingFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.5;

    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);

    cr.newSubPath().arcNegative(centerX, centerY, innerRadius, 2 * Math.PI, 0);

    cr.setFillRule(FillRule.WINDING)
        .setSourceRgb(0.9, 0.5, 0.2)
        .fillPreserve()
        .setSourceRgb(0.6, 0.3, 0.1)
        .setLineWidth(2)
        .stroke();
};

const drawComplexPolygon = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 15;
    const points = 6;

    for (let i = 0; i < points; i++) {
        const angle = (i * 2 * Math.PI) / points - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            cr.moveTo(x, y);
        } else {
            cr.lineTo(x, y);
        }
    }
    cr.closePath();

    const gradient = Pattern.createLinear(0, 0, width, height)
        .addColorStopRgb(0, 0.4, 0.8, 0.4)
        .addColorStopRgb(1, 0.2, 0.5, 0.3);

    cr.setSource(gradient).fillPreserve().setSourceRgb(0.1, 0.4, 0.2).setLineWidth(3).stroke();
};

const GTK_LOGO_COLORS = {
    red: { r: 0.89, g: 0.16, b: 0.16 },
    green: { r: 0.49, g: 0.88, b: 0.2 },
    blue: { r: 0.27, g: 0.52, b: 0.89 },
};

const drawGtkLogoPath = (cr: Context, scale: number, offsetX: number, offsetY: number) => {
    cr.save().translate(offsetX, offsetY).scale(scale, scale);

    cr.moveTo(3.12, 66.17)
        .relLineTo(-2.06, -51.46)
        .relLineTo(32.93, 24.7)
        .relLineTo(0, 55.58)
        .relLineTo(-30.87, -28.82)
        .closePath();
    cr.setSourceRgb(GTK_LOGO_COLORS.red.r, GTK_LOGO_COLORS.red.g, GTK_LOGO_COLORS.red.b).fill();

    cr.moveTo(34, 95)
        .relLineTo(49.4, -20.58)
        .relLineTo(4.12, -51.46)
        .relLineTo(-53.52, 16.47)
        .relLineTo(0, 55.58)
        .closePath();
    cr.setSourceRgb(GTK_LOGO_COLORS.green.r, GTK_LOGO_COLORS.green.g, GTK_LOGO_COLORS.green.b).fill();

    cr.moveTo(1.06, 14.71)
        .relLineTo(32.93, 24.7)
        .relLineTo(53.52, -16.47)
        .relLineTo(-36.75, -21.88)
        .relLineTo(-49.7, 13.65)
        .closePath();
    cr.setSourceRgb(GTK_LOGO_COLORS.blue.r, GTK_LOGO_COLORS.blue.g, GTK_LOGO_COLORS.blue.b).fill();

    cr.setSourceRgb(1, 1, 1).setLineWidth(2.12 / scale);

    cr.moveTo(3.12, 66.17)
        .relLineTo(-2.06, -51.46)
        .relLineTo(32.93, 24.7)
        .relLineTo(0, 55.58)
        .relLineTo(-30.87, -28.82)
        .closePath()
        .stroke();

    cr.moveTo(34, 95)
        .relLineTo(49.4, -20.58)
        .relLineTo(4.12, -51.46)
        .relLineTo(-53.52, 16.47)
        .relLineTo(0, 55.58)
        .closePath()
        .stroke();

    cr.moveTo(1.06, 14.71)
        .relLineTo(32.93, 24.7)
        .relLineTo(53.52, -16.47)
        .relLineTo(-36.75, -21.88)
        .relLineTo(-49.7, 13.65)
        .closePath()
        .stroke();

    cr.restore();
};

const drawGtkLogo = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const logoWidth = 90;
    const logoHeight = 95;
    const scale = Math.min(width / logoWidth, height / logoHeight) * 0.8;
    const offsetX = (width - logoWidth * scale) / 2;
    const offsetY = (height - logoHeight * scale) / 2;

    drawGtkLogoPath(cr, scale, offsetX, offsetY);
};

const DrawingCanvas = ({
    width,
    height,
    drawFunc,
    label,
}: {
    width: number;
    height: number;
    drawFunc: (self: Gtk.DrawingArea, cr: Context, width: number, height: number) => void;
    label: string;
}) => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
            <GtkDrawingArea onDraw={drawFunc} contentWidth={width} contentHeight={height} cssClasses={["card"]} />
            <GtkLabel label={label} cssClasses={["dim-label", "caption"]} />
        </GtkBox>
    );
};

const PathFillDemo = () => {
    const [exportStatus, setExportStatus] = useState<string | null>(null);

    const handleExportPdf = useCallback(() => {
        void (async () => {
            const dialog = new Gtk.FileDialog();
            dialog.setTitle("Export GTK Logo as PDF");
            dialog.setInitialName("gtk-logo.pdf");

            const pdfFilter = new Gtk.FileFilter();
            pdfFilter.setName("PDF Documents");
            pdfFilter.addPattern("*.pdf");
            pdfFilter.addMimeType("application/pdf");

            const filters = new Gio.ListStore(GObject.typeFromName("GtkFileFilter"));
            filters.append(pdfFilter);
            dialog.setFilters(filters);
            dialog.setDefaultFilter(pdfFilter);

            try {
                const file = await dialog.saveAsync(null, null);
                if (file) {
                    const path = file.getPath();
                    if (path) {
                        const width = 200;
                        const height = 210;
                        const surface = new PdfSurface(path, width, height);
                        const cr = surface.createContext();

                        const logoWidth = 90;
                        const logoHeight = 95;
                        const scale = Math.min(width / logoWidth, height / logoHeight) * 0.8;
                        const offsetX = (width - logoWidth * scale) / 2;
                        const offsetY = (height - logoHeight * scale) / 2;

                        drawGtkLogoPath(cr, scale, offsetX, offsetY);

                        cr.showPage();
                        surface.finish();

                        setExportStatus(`Exported to ${path}`);
                        setTimeout(() => setExportStatus(null), 3000);
                    }
                }
            } catch {
                setExportStatus(null);
            }
        })();
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Vector Path Fills" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Paths can be filled with solid colors, linear gradients, or radial gradients. The fill rule determines how overlapping paths are filled."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="GTK Logo">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <DrawingCanvas
                            width={200}
                            height={210}
                            drawFunc={drawGtkLogo}
                            label="GTK Logo (Vector Paths)"
                        />
                    </GtkBox>
                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label="Export as PDF"
                            onClicked={handleExportPdf}
                            cssClasses={["suggested-action"]}
                        />
                        {exportStatus && <GtkLabel label={exportStatus} cssClasses={["dim-label"]} />}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Solid & Gradient Fills">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={140} height={140} drawFunc={drawSolidFill} label="Solid Fill (Heart)" />
                    <DrawingCanvas width={160} height={120} drawFunc={drawLinearGradient} label="Linear Gradient" />
                    <DrawingCanvas width={140} height={140} drawFunc={drawRadialGradient} label="Radial Gradient" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Fill Rules">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Fill rules determine how overlapping paths are filled. Even-odd creates holes when paths overlap, while winding considers path direction."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={32} halign={Gtk.Align.CENTER}>
                        <DrawingCanvas width={140} height={140} drawFunc={drawEvenOddFill} label="Even-Odd Fill Rule" />
                        <DrawingCanvas
                            width={140}
                            height={140}
                            drawFunc={drawWindingFill}
                            label="Winding Fill Rule (CCW inner)"
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Complex Shapes">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas
                        width={160}
                        height={160}
                        drawFunc={drawComplexPolygon}
                        label="Hexagon with Gradient"
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathFillDemo: Demo = {
    id: "path-fill",
    title: "Path/Fill and Stroke",
    description: "Vector path fills with gradients and fill rules",
    keywords: ["path", "fill", "gradient", "linear", "radial", "even-odd", "winding", "vector", "cairo"],
    component: PathFillDemo,
    sourceCode,
};

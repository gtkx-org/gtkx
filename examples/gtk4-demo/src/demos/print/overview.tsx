import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const PrintOverviewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Printing" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Printing" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GTK provides comprehensive printing support through GtkPrintOperation. This high-level API handles printer selection, page setup, and integrates with the native system print dialog."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Print Components" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• GtkPrintOperation - Main print job controller\n• GtkPrintContext - Provides Cairo context for page rendering\n• GtkPageSetup - Page size, margins, and orientation\n• GtkPrintSettings - Printer preferences and options"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Print Signals" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• begin-print - Called before printing starts\n• draw-page - Render each page with Cairo\n• end-print - Called after all pages are printed\n• done - Print job completion status"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• Native system print dialog\n• Print to file (PDF export)\n• Page setup dialog\n• Print preview support\n• Asynchronous printing\n• Progress indication"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const printOverviewDemo: Demo = {
    id: "print-overview",
    title: "Printing Overview",
    description: "Document printing with GtkPrintOperation.",
    keywords: ["print", "printer", "document", "paper", "pdf"],
    component: PrintOverviewDemo,
    sourcePath: getSourcePath(import.meta.url, "overview.tsx"),
};

import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, useApplication } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./printing.tsx?raw";

// Sample content to print
const SAMPLE_LINES = [
    "GTKX Printing Demo",
    "",
    "This is a demonstration of GTK4's printing capabilities.",
    "The PrintOperation API provides a high-level interface for printing.",
    "",
    "Features demonstrated:",
    "- Print dialog integration",
    "- Page rendering with Cairo",
    "- Print preview functionality",
    "- Multi-page document support",
    "",
    "Page rendering uses the same Cairo API as GtkDrawingArea,",
    "making it easy to create consistent printed output.",
    "",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
    "Laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit.",
    "Esse cillum dolore eu fugiat nulla pariatur.",
];

const LINES_PER_PAGE = 15;
const MARGIN = 50;
const LINE_HEIGHT = 20;

const PrintingDemo = () => {
    const app = useApplication();
    const [printStatus, setPrintStatus] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);
    const previewRef = useRef<Gtk.DrawingArea | null>(null);
    const [previewPage, setPreviewPage] = useState(0);

    const totalPages = Math.ceil(SAMPLE_LINES.length / LINES_PER_PAGE);

    // Draw preview of what will be printed
    const drawPreview = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            // White paper background
            cr.setSourceRgb(1, 1, 1).rectangle(0, 0, width, height).fill();

            // Draw border
            cr.setSourceRgb(0.8, 0.8, 0.8)
                .setLineWidth(1)
                .rectangle(0.5, 0.5, width - 1, height - 1)
                .stroke();

            // Calculate scale to fit content
            const scale = Math.min(width / 612, height / 792); // US Letter in points
            const offsetX = (width - 612 * scale) / 2;
            const offsetY = (height - 792 * scale) / 2;

            cr.save().translate(offsetX, offsetY).scale(scale, scale);

            // Draw margin indicators
            cr.setSourceRgba(0.9, 0.9, 0.9, 0.5)
                .rectangle(0, 0, MARGIN, 792)
                .fill()
                .rectangle(612 - MARGIN, 0, MARGIN, 792)
                .fill()
                .rectangle(0, 0, 612, MARGIN)
                .fill()
                .rectangle(0, 792 - MARGIN, 612, MARGIN)
                .fill();

            // Draw text content using Pango
            const startLine = previewPage * LINES_PER_PAGE;
            const endLine = Math.min(startLine + LINES_PER_PAGE, SAMPLE_LINES.length);

            for (let i = startLine; i < endLine; i++) {
                const y = MARGIN + (i - startLine) * LINE_HEIGHT;
                const line = SAMPLE_LINES[i];

                const layout = PangoCairo.createLayout(cr);
                layout.setText(line ?? "", -1);

                if (i === startLine && previewPage === 0) {
                    // Title - larger and blue
                    cr.setSourceRgb(0.2, 0.4, 0.8);
                    layout.setFontDescription(Pango.FontDescription.fromString("Sans Bold 14"));
                } else {
                    cr.setSourceRgb(0, 0, 0);
                    layout.setFontDescription(Pango.FontDescription.fromString("Sans 10"));
                }

                cr.moveTo(MARGIN, y);
                PangoCairo.showLayout(cr, layout);
            }

            // Page number
            const pageLayout = PangoCairo.createLayout(cr);
            pageLayout.setText(`Page ${previewPage + 1} of ${totalPages}`, -1);
            pageLayout.setFontDescription(Pango.FontDescription.fromString("Sans 8"));
            cr.setSourceRgb(0.5, 0.5, 0.5);
            cr.moveTo(270, 792 - 30);
            PangoCairo.showLayout(cr, pageLayout);

            cr.restore();
        },
        [previewPage, totalPages],
    );

    useEffect(() => {
        if (previewRef.current) {
            previewRef.current.setDrawFunc(drawPreview);
        }
    }, [drawPreview]);

    const handlePrint = () => {
        try {
            const printOp = new Gtk.PrintOperation();
            printOp.setNPages(totalPages);
            printOp.setJobName("GTKX Demo Print");
            printOp.setShowProgress(true);

            // Set up page setup
            const pageSetup = new Gtk.PageSetup();
            pageSetup.setOrientation(Gtk.PageOrientation.PORTRAIT);
            printOp.setDefaultPageSetup(pageSetup);

            // Handle begin-print signal
            printOp.connect("begin-print", (_self: Gtk.PrintOperation, context: Gtk.PrintContext) => {
                setPrintStatus("Preparing print job...");
                // Calculate pages based on content
                const pageHeight = context.getHeight();
                const linesPerPage = Math.floor((pageHeight - 2 * MARGIN) / LINE_HEIGHT);
                const pages = Math.ceil(SAMPLE_LINES.length / linesPerPage);
                printOp.setNPages(pages);
            });

            // Handle draw-page signal
            printOp.connect("draw-page", (_self: Gtk.PrintOperation, context: Gtk.PrintContext, pageNr: number) => {
                setPrintStatus(`Rendering page ${pageNr + 1}...`);
                const cr = context.getCairoContext();
                const width = context.getWidth();

                // Draw a decorative header line
                cr.setSourceRgb(0.2, 0.4, 0.8)
                    .setLineWidth(2)
                    .moveTo(MARGIN, MARGIN - 10)
                    .lineTo(width - MARGIN, MARGIN - 10)
                    .stroke();

                // Draw page content using Pango
                const startLine = pageNr * LINES_PER_PAGE;
                const endLine = Math.min(startLine + LINES_PER_PAGE, SAMPLE_LINES.length);

                for (let i = startLine; i < endLine; i++) {
                    const y = MARGIN + (i - startLine) * LINE_HEIGHT;
                    const line = SAMPLE_LINES[i];

                    const layout = PangoCairo.createLayout(cr);
                    layout.setText(line ?? "", -1);

                    if (i === 0 && pageNr === 0) {
                        // Title - larger and blue
                        cr.setSourceRgb(0.2, 0.4, 0.8);
                        layout.setFontDescription(Pango.FontDescription.fromString("Sans Bold 14"));
                    } else {
                        cr.setSourceRgb(0, 0, 0);
                        layout.setFontDescription(Pango.FontDescription.fromString("Sans 10"));
                    }

                    cr.moveTo(MARGIN, y);
                    PangoCairo.showLayout(cr, layout);
                }

                // Draw page number
                const pageLayout = PangoCairo.createLayout(cr);
                pageLayout.setText(`Page ${pageNr + 1} of ${totalPages}`, -1);
                pageLayout.setFontDescription(Pango.FontDescription.fromString("Sans 8"));
                cr.setSourceRgb(0.5, 0.5, 0.5);
                cr.moveTo(width / 2 - 30, context.getHeight() - 30);
                PangoCairo.showLayout(cr, pageLayout);
            });

            // Handle end-print signal
            printOp.connect("end-print", () => {
                setPrintStatus("Print job completed");
            });

            // Handle status changes
            printOp.connect("status-changed", (self: Gtk.PrintOperation) => {
                setPrintStatus(self.getStatusString());
            });

            // Run the print operation
            const result = printOp.run(Gtk.PrintOperationAction.PRINT_DIALOG, app.getActiveWindow() ?? undefined);

            const resultMap: Record<number, string> = {
                [Gtk.PrintOperationResult.ERROR]: "Error occurred",
                [Gtk.PrintOperationResult.APPLY]: "Print job sent",
                [Gtk.PrintOperationResult.CANCEL]: "Print cancelled",
                [Gtk.PrintOperationResult.IN_PROGRESS]: "Printing in progress",
            };
            setLastResult(resultMap[result] ?? `Result: ${result}`);
        } catch (error) {
            setLastResult(`Error: ${error}`);
            setPrintStatus(null);
        }
    };

    const handlePrintPreview = () => {
        try {
            const printOp = new Gtk.PrintOperation();
            printOp.setNPages(totalPages);
            printOp.setJobName("GTKX Demo Preview");

            const result = printOp.run(Gtk.PrintOperationAction.PREVIEW, app.getActiveWindow() ?? undefined);

            const resultMap: Record<number, string> = {
                [Gtk.PrintOperationResult.ERROR]: "Error occurred",
                [Gtk.PrintOperationResult.APPLY]: "Preview closed",
                [Gtk.PrintOperationResult.CANCEL]: "Preview cancelled",
                [Gtk.PrintOperationResult.IN_PROGRESS]: "Preview in progress",
            };
            setLastResult(resultMap[result] ?? `Result: ${result}`);
        } catch (error) {
            setLastResult(`Error: ${error}`);
        }
    };

    const handleExportPdf = async () => {
        try {
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Export to PDF");
            fileDialog.setModal(true);
            fileDialog.setInitialName("document.pdf");

            const file = await fileDialog.saveAsync(app.getActiveWindow() ?? undefined);
            const filePath = file.getPath();

            if (filePath) {
                const printOp = new Gtk.PrintOperation();
                printOp.setNPages(totalPages);
                printOp.setExportFilename(filePath);

                printOp.connect("draw-page", (_self: Gtk.PrintOperation, context: Gtk.PrintContext, pageNr: number) => {
                    const cr = context.getCairoContext();
                    const width = context.getWidth();

                    // Draw header
                    cr.setSourceRgb(0.2, 0.4, 0.8)
                        .setLineWidth(2)
                        .moveTo(MARGIN, MARGIN - 10)
                        .lineTo(width - MARGIN, MARGIN - 10)
                        .stroke();

                    // Draw content using Pango
                    const startLine = pageNr * LINES_PER_PAGE;
                    const endLine = Math.min(startLine + LINES_PER_PAGE, SAMPLE_LINES.length);

                    for (let i = startLine; i < endLine; i++) {
                        const y = MARGIN + (i - startLine) * LINE_HEIGHT;
                        const line = SAMPLE_LINES[i];

                        const layout = PangoCairo.createLayout(cr);
                        layout.setText(line ?? "", -1);

                        if (i === 0 && pageNr === 0) {
                            cr.setSourceRgb(0.2, 0.4, 0.8);
                            layout.setFontDescription(Pango.FontDescription.fromString("Sans Bold 14"));
                        } else {
                            cr.setSourceRgb(0, 0, 0);
                            layout.setFontDescription(Pango.FontDescription.fromString("Sans 10"));
                        }

                        cr.moveTo(MARGIN, y);
                        PangoCairo.showLayout(cr, layout);
                    }

                    // Draw page number
                    const pageLayout = PangoCairo.createLayout(cr);
                    pageLayout.setText(`Page ${pageNr + 1} of ${totalPages}`, -1);
                    pageLayout.setFontDescription(Pango.FontDescription.fromString("Sans 8"));
                    cr.setSourceRgb(0.5, 0.5, 0.5);
                    cr.moveTo(width / 2 - 30, context.getHeight() - 30);
                    PangoCairo.showLayout(cr, pageLayout);
                });

                const result = printOp.run(Gtk.PrintOperationAction.EXPORT, app.getActiveWindow() ?? undefined);

                if (result === Gtk.PrintOperationResult.APPLY) {
                    setLastResult(`Exported to: ${filePath}`);
                } else {
                    setLastResult("Export cancelled");
                }
            }
        } catch {
            // User cancelled file dialog
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Print Operations" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkPrintOperation provides a high-level API for printing documents. It handles the print dialog, page rendering callbacks, and printer communication."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {/* Print Actions */}
            <GtkFrame label="Print Actions">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Use GtkPrintOperation to show the print dialog, preview documents, or export directly to PDF."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkButton label="Print..." onClicked={handlePrint} />
                        <GtkButton label="Print Preview" onClicked={handlePrintPreview} />
                        <GtkButton label="Export to PDF..." onClicked={() => void handleExportPdf()} />
                    </GtkBox>
                    {printStatus && (
                        <GtkLabel
                            label={`Status: ${printStatus}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    )}
                    {lastResult && (
                        <GtkLabel label={`Result: ${lastResult}`} halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                    )}
                </GtkBox>
            </GtkFrame>

            {/* Page Preview */}
            <GtkFrame label="Page Preview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkDrawingArea ref={previewRef} contentWidth={200} contentHeight={260} cssClasses={["card"]} />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            iconName="go-previous-symbolic"
                            onClicked={() => setPreviewPage((p) => Math.max(0, p - 1))}
                            sensitive={previewPage > 0}
                        />
                        <GtkLabel label={`Page ${previewPage + 1} of ${totalPages}`} />
                        <GtkButton
                            iconName="go-next-symbolic"
                            onClicked={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                            sensitive={previewPage < totalPages - 1}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* Print Operation Signals */}
            <GtkFrame label="PrintOperation Signals">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Key signals for print operations:"
                        halign={Gtk.Align.START}
                        cssClasses={["heading"]}
                    />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkLabel
                            label="begin-print: Called when printing starts, set page count here"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                        <GtkLabel
                            label="draw-page: Called for each page, render content with Cairo"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                        <GtkLabel
                            label="end-print: Called when printing completes"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                        <GtkLabel
                            label="status-changed: Track print job progress"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                        <GtkLabel
                            label="request-page-setup: Customize page setup per page"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* Print Settings */}
            <GtkFrame label="Print Settings">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="PrintOperation configuration options:"
                        halign={Gtk.Align.START}
                        cssClasses={["heading"]}
                    />
                    <GtkLabel
                        label={`setNPages(n) - Set total page count
setJobName(name) - Set print job name
setShowProgress(true) - Show progress dialog
setDefaultPageSetup(setup) - Configure page layout
setPrintSettings(settings) - Apply saved settings
setExportFilename(path) - Export to PDF
setAllowAsync(true) - Enable async printing`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const printingDemo: Demo = {
    id: "printing",
    title: "Printing",
    description: "Print dialog and document printing with GtkPrintOperation",
    keywords: ["print", "printing", "dialog", "GtkPrintOperation", "pdf", "export", "preview", "page", "document"],
    component: PrintingDemo,
    sourceCode,
};

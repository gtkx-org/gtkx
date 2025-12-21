import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

type PrintStatus = "idle" | "printing" | "completed" | "cancelled" | "error";

const PrintDialogDemo = () => {
    const [status, setStatus] = useState<PrintStatus>("idle");
    const [message, setMessage] = useState<string>("");

    const handlePrint = () => {
        setStatus("printing");
        setMessage("Opening print dialog...");

        try {
            const printOp = new Gtk.PrintOperation();
            printOp.setJobName("GTKX Demo Print Job");
            printOp.setNPages(1);
            printOp.setShowProgress(true);

            const result = printOp.run(Gtk.PrintOperationAction.PRINT_DIALOG);

            if (result === Gtk.PrintOperationResult.APPLY) {
                setStatus("completed");
                setMessage("Print job sent successfully!");
            } else if (result === Gtk.PrintOperationResult.CANCEL) {
                setStatus("cancelled");
                setMessage("Print dialog was cancelled");
            } else if (result === Gtk.PrintOperationResult.ERROR) {
                setStatus("error");
                setMessage("Print operation failed");
            } else {
                setStatus("idle");
                setMessage("Print dialog closed");
            }
        } catch (err) {
            setStatus("error");
            setMessage(`Print error: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleExportPdf = () => {
        setStatus("printing");
        setMessage("Exporting to PDF...");

        try {
            const printOp = new Gtk.PrintOperation();
            printOp.setJobName("GTKX Demo PDF Export");
            printOp.setNPages(1);
            printOp.setExportFilename("/tmp/gtkx-demo-export.pdf");

            const result = printOp.run(Gtk.PrintOperationAction.EXPORT);

            if (result === Gtk.PrintOperationResult.APPLY) {
                setStatus("completed");
                setMessage("PDF exported to /tmp/gtkx-demo-export.pdf");
            } else {
                setStatus("error");
                setMessage("PDF export failed");
            }
        } catch (err) {
            setStatus("error");
            setMessage(`Export error: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case "printing":
                return "[...]";
            case "completed":
                return "[OK]";
            case "cancelled":
                return "[X]";
            case "error":
                return "[!]";
            default:
                return "[_]";
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Print Dialog" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel
                    label="GtkPrintOperation provides a high-level API for printing documents. It handles printer selection, page setup, and integrates with the system print dialog."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Print Actions" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkButton label="Print..." cssClasses={["suggested-action"]} onClicked={handlePrint} />
                    <GtkButton label="Export PDF" onClicked={handleExportPdf} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={8}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label={getStatusIcon()} />
                    <GtkLabel label={message || "Ready to print"} wrap hexpand />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Note" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Print functionality requires Cairo context integration for page rendering. The print dialog will open but pages will be blank without custom draw-page signal handling."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`- Native print dialog integration
- Page setup configuration
- Print preview support
- PDF export capability
- Multiple pages support
- Print settings persistence`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const printDialogDemo: Demo = {
    id: "print-dialog",
    title: "Print Dialog",
    description: "Print documents with native system print dialog.",
    keywords: ["print", "dialog", "pdf", "export", "GtkPrintOperation"],
    component: PrintDialogDemo,
    sourcePath: getSourcePath(import.meta.url, "print-dialog.tsx"),
};

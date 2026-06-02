import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { useEffect } from "react";
import type { Demo, DemoProps } from "../types.js";
import { configurePrintOperation } from "./print-operation.js";
import sourceCode from "./print-operation.ts?raw";

const runPrintOperation = (window: Gtk.Window | null, source: string, onDone: () => void) => {
    const printOp = configurePrintOperation(source);
    printOp.on("done", () => onDone());
    try {
        printOp.run(Gtk.PrintOperationAction.PRINT_DIALOG, window);
    } catch (error) {
        const dialog = new Adw.AlertDialog();
        dialog.setHeading(`${error}`);
        dialog.addResponse("ok", "_OK");
        dialog.setDefaultResponse("ok");
        dialog.setCloseResponse("ok");
        dialog.present(window);
        onDone();
    }
};

const PrintingDemo = ({ window, onClose }: DemoProps) => {
    useEffect(() => {
        runPrintOperation(window.current, sourceCode, () => onClose?.());
    }, [window, onClose]);

    return null;
};

export const printingDemo: Demo = {
    id: "printing",
    title: "Printing/Printing",
    description: "GtkPrintOperation offers a simple API to support printing in a cross-platform way.",
    keywords: [],
    component: PrintingDemo,
    sourceCode,
    dialogOnly: true,
};

import * as Adw from "@gtkx/ffi/adw";
import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { useEffect } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./printing.tsx?raw";

const HEADER_HEIGHT = (10 * 72) / 25.4;
const HEADER_GAP = (3 * 72) / 25.4;
const FONT_SIZE = 12;

const drawPageHeader = ({
    cr,
    width,
    context,
    pageNr,
    numPages,
}: {
    cr: Context;
    width: number;
    context: Gtk.PrintContext;
    pageNr: number;
    numPages: number;
}) => {
    cr.rectangle(0, 0, width, HEADER_HEIGHT);
    cr.setSourceRgb(0.8, 0.8, 0.8);
    cr.fillPreserve();
    cr.setSourceRgb(0, 0, 0);
    cr.setLineWidth(1);
    cr.stroke();

    const headerLayout = context.createPangoLayout();
    headerLayout.setFontDescription(Pango.FontDescription.fromString("sans 14"));
    headerLayout.setText("printing.tsx", -1);

    let [, logicalRect] = headerLayout.getPixelExtents();
    let textWidth = logicalRect.width;
    let textHeight = logicalRect.height;

    if (textWidth > width) {
        headerLayout.setWidth(Math.floor(width));
        headerLayout.setEllipsize(Pango.EllipsizeMode.START);
        [, logicalRect] = headerLayout.getPixelExtents();
        textWidth = logicalRect.width;
        textHeight = logicalRect.height;
    }

    cr.moveTo((width - textWidth) / 2, (HEADER_HEIGHT - textHeight) / 2);
    PangoCairo.showLayout(cr, headerLayout);

    const pageStr = `${pageNr + 1}/${numPages}`;
    headerLayout.setText(pageStr, -1);
    headerLayout.setWidth(-1);
    [, logicalRect] = headerLayout.getPixelExtents();
    cr.moveTo(width - logicalRect.width - 4, (HEADER_HEIGHT - logicalRect.height) / 2);
    PangoCairo.showLayout(cr, headerLayout);
};

const drawPageBody = ({
    cr,
    context,
    lines,
    pageNr,
    linesPerPage,
}: {
    cr: Context;
    context: Gtk.PrintContext;
    lines: string[];
    pageNr: number;
    linesPerPage: number;
}) => {
    const bodyLayout = context.createPangoLayout();
    const bodyDesc = Pango.FontDescription.fromString("monospace");
    bodyDesc.setSize(FONT_SIZE * Pango.SCALE);
    bodyLayout.setFontDescription(bodyDesc);

    cr.moveTo(0, HEADER_HEIGHT + HEADER_GAP);

    const startLine = pageNr * linesPerPage;
    for (let i = 0; i < linesPerPage && startLine + i < lines.length; i++) {
        bodyLayout.setText(lines[startLine + i] ?? "", -1);
        PangoCairo.showLayout(cr, bodyLayout);
        cr.relMoveTo(0, FONT_SIZE);
    }
};

export const configurePrintOperation = (source: string): Gtk.PrintOperation => {
    const lines = source.split("\n");
    const numLines = lines.length;

    const printOp = new Gtk.PrintOperation();
    printOp.setAllowAsync(true);
    printOp.setUseFullPage(false);
    printOp.setUnit(Gtk.Unit.POINTS);
    printOp.setEmbedPageSetup(true);

    const settings = new Gtk.PrintSettings();
    settings.set(Gtk.PRINT_SETTINGS_OUTPUT_BASENAME, "gtk-demo");
    printOp.setPrintSettings(settings);

    let linesPerPage = 0;
    let numPages = 0;

    printOp.on("begin-print", (context: Gtk.PrintContext) => {
        const height = context.getHeight() - HEADER_HEIGHT - HEADER_GAP;
        linesPerPage = Math.floor(height / FONT_SIZE);
        numPages = Math.ceil(numLines / linesPerPage);
        printOp.setNPages(numPages);
    });

    printOp.on("draw-page", (context: Gtk.PrintContext, pageNr: number) => {
        const cr = context.getCairoContext();
        const width = context.getWidth();
        drawPageHeader({ cr, width, context, pageNr, numPages });
        drawPageBody({ cr, context, lines, pageNr, linesPerPage });
    });

    return printOp;
};

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

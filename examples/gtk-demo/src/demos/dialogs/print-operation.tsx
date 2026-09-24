import type { Context } from "@gtkx/cairo";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import * as PangoCairo from "@gtkx/gi/pangocairo";
import { GtkPrintOperation, GtkPrintSettings } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { type ComponentProps, useEffect, useEffectEvent, useRef, useState } from "react";

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
    headerLayout.setText("print-operation.tsx", -1);
    let [, logicalRect] = headerLayout.getPixelExtents();
    let textWidth = logicalRect.width;
    let textHeight = logicalRect.height;

    if (textWidth > width) {
        headerLayout.setWidth(Math.floor(width * Pango.SCALE));
        headerLayout.setEllipsize(Pango.EllipsizeMode.START);
        [, logicalRect] = headerLayout.getPixelExtents();
        textWidth = logicalRect.width;
        textHeight = logicalRect.height;
    }

    cr.moveTo((width - textWidth) / 2, (HEADER_HEIGHT - textHeight) / 2);
    PangoCairo.showLayout(cr, headerLayout);
    const pageStr = `${String(pageNr + 1)}/${String(numPages)}`;
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
        bodyLayout.setText(lines[startLine + i] as string, -1);
        PangoCairo.showLayout(cr, bodyLayout);
        cr.relMoveTo(0, FONT_SIZE);
    }
};

type PrintOperationProps = Pick<ComponentProps<typeof GtkPrintOperation>, "exportFilename" | "onDone"> & {
    source: string;
    action: Gtk.PrintOperationAction;
    parent: Gtk.Window | null;
    onError?: ((error: unknown) => void) | undefined;
};

const initializeSettings = (settings: Gtk.PrintSettings | null): void => {
    settings?.set(Gtk.PRINT_SETTINGS_OUTPUT_BASENAME, "gtk-demo");
};

const PrintOperation = ({ source, action, parent, onError, ...props }: PrintOperationProps) => {
    const pagination = useRef({ lines: source.split("\n"), linesPerPage: 0, numPages: 0 });
    const [operation, setOperation] = useState<Gtk.PrintOperation | null>(null);
    const runOperation = useEffectEvent((current: Gtk.PrintOperation) => {
        try {
            current.run(action, parent);
        } catch (error) {
            if (onError === undefined) {
                throw error;
            }

            onError(error);
        }
    });

    useEffect(() => {
        if (operation !== null) {
            runOperation(operation);
        }
    }, [operation]);

    return createPortal(
        <GtkPrintOperation
            {...props}
            ref={setOperation}
            allowAsync
            useFullPage={false}
            unit={Gtk.Unit.POINTS}
            embedPageSetup
            printSettings={<GtkPrintSettings ref={initializeSettings} />}
            onBeginPrint={(context, operation) => {
                const page = pagination.current;
                const height = context.getHeight() - HEADER_HEIGHT - HEADER_GAP;
                page.linesPerPage = Math.floor(height / FONT_SIZE);
                page.numPages = Math.ceil(page.lines.length / page.linesPerPage);
                operation.setNPages(page.numPages);
            }}
            onDrawPage={(context, pageNr) => {
                const { lines, linesPerPage, numPages } = pagination.current;
                const cr = context.getCairoContext();
                const width = context.getWidth();
                drawPageHeader({ cr, width, context, pageNr, numPages });
                drawPageBody({ cr, context, lines, pageNr, linesPerPage });
            }}
        />,
        rootElement,
    );
};

export { PrintOperation };

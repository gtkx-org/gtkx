import type { Context } from "@gtkx/ffi/cairo";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkSpinButton, useApplication } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./pagesetup.tsx?raw";

// Paper size presets with dimensions in mm
const PAPER_SIZES = [
    { name: "A4", width: 210, height: 297 },
    { name: "A5", width: 148, height: 210 },
    { name: "Letter", width: 216, height: 279 },
    { name: "Legal", width: 216, height: 356 },
    { name: "B5", width: 176, height: 250 },
];

const ORIENTATION_LABELS: Record<number, string> = {
    [Gtk.PageOrientation.PORTRAIT]: "Portrait",
    [Gtk.PageOrientation.LANDSCAPE]: "Landscape",
    [Gtk.PageOrientation.REVERSE_PORTRAIT]: "Reverse Portrait",
    [Gtk.PageOrientation.REVERSE_LANDSCAPE]: "Reverse Landscape",
};

const PageSetupDemo = () => {
    const app = useApplication();
    const previewRef = useRef<Gtk.DrawingArea | null>(null);

    // Current page setup state
    const [paperSize, setPaperSize] = useState(PAPER_SIZES[0] ?? { name: "A4", width: 210, height: 297 });
    const [orientation, setOrientation] = useState<Gtk.PageOrientation>(Gtk.PageOrientation.PORTRAIT);
    const [topMargin, setTopMargin] = useState(25.4); // 1 inch in mm
    const [bottomMargin, setBottomMargin] = useState(25.4);
    const [leftMargin, setLeftMargin] = useState(25.4);
    const [rightMargin, setRightMargin] = useState(25.4);
    const [lastDialogResult, setLastDialogResult] = useState<string | null>(null);

    // Create adjustments for spin buttons
    const topMarginAdj = useMemo(() => new Gtk.Adjustment(topMargin, 0, 100, 1, 10, 0), [topMargin]);
    const bottomMarginAdj = useMemo(() => new Gtk.Adjustment(bottomMargin, 0, 100, 1, 10, 0), [bottomMargin]);
    const leftMarginAdj = useMemo(() => new Gtk.Adjustment(leftMargin, 0, 100, 1, 10, 0), [leftMargin]);
    const rightMarginAdj = useMemo(() => new Gtk.Adjustment(rightMargin, 0, 100, 1, 10, 0), [rightMargin]);

    useEffect(() => {
        const topId = topMarginAdj.connect("value-changed", (adj: Gtk.Adjustment) => setTopMargin(adj.getValue()));
        const bottomId = bottomMarginAdj.connect("value-changed", (adj: Gtk.Adjustment) =>
            setBottomMargin(adj.getValue()),
        );
        const leftId = leftMarginAdj.connect("value-changed", (adj: Gtk.Adjustment) => setLeftMargin(adj.getValue()));
        const rightId = rightMarginAdj.connect("value-changed", (adj: Gtk.Adjustment) =>
            setRightMargin(adj.getValue()),
        );

        return () => {
            GObject.signalHandlerDisconnect(topMarginAdj, topId);
            GObject.signalHandlerDisconnect(bottomMarginAdj, bottomId);
            GObject.signalHandlerDisconnect(leftMarginAdj, leftId);
            GObject.signalHandlerDisconnect(rightMarginAdj, rightId);
        };
    }, [topMarginAdj, bottomMarginAdj, leftMarginAdj, rightMarginAdj]);

    // Calculate effective dimensions based on orientation
    const effectiveWidth =
        orientation === Gtk.PageOrientation.LANDSCAPE || orientation === Gtk.PageOrientation.REVERSE_LANDSCAPE
            ? paperSize.height
            : paperSize.width;
    const effectiveHeight =
        orientation === Gtk.PageOrientation.LANDSCAPE || orientation === Gtk.PageOrientation.REVERSE_LANDSCAPE
            ? paperSize.width
            : paperSize.height;

    // Draw page preview
    const drawPreview = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            // Background
            cr.setSourceRgb(0.9, 0.9, 0.9).rectangle(0, 0, width, height).fill();

            // Calculate scale to fit page in preview
            const scale = Math.min((width - 20) / effectiveWidth, (height - 20) / effectiveHeight);
            const pageWidth = effectiveWidth * scale;
            const pageHeight = effectiveHeight * scale;
            const offsetX = (width - pageWidth) / 2;
            const offsetY = (height - pageHeight) / 2;

            // Draw paper shadow
            cr.setSourceRgba(0, 0, 0, 0.2)
                .rectangle(offsetX + 3, offsetY + 3, pageWidth, pageHeight)
                .fill();

            // Draw paper
            cr.setSourceRgb(1, 1, 1).rectangle(offsetX, offsetY, pageWidth, pageHeight).fill();

            // Draw paper border
            cr.setSourceRgb(0.7, 0.7, 0.7)
                .setLineWidth(1)
                .rectangle(offsetX + 0.5, offsetY + 0.5, pageWidth - 1, pageHeight - 1)
                .stroke();

            // Draw margins
            const marginTop = topMargin * scale;
            const marginBottom = bottomMargin * scale;
            const marginLeft = leftMargin * scale;
            const marginRight = rightMargin * scale;

            // Margin area (light blue tint)
            cr.setSourceRgba(0.7, 0.85, 1, 0.3);
            // Top margin
            cr.rectangle(offsetX, offsetY, pageWidth, marginTop).fill();
            // Bottom margin
            cr.rectangle(offsetX, offsetY + pageHeight - marginBottom, pageWidth, marginBottom).fill();
            // Left margin
            cr.rectangle(offsetX, offsetY + marginTop, marginLeft, pageHeight - marginTop - marginBottom).fill();
            // Right margin
            cr.rectangle(
                offsetX + pageWidth - marginRight,
                offsetY + marginTop,
                marginRight,
                pageHeight - marginTop - marginBottom,
            ).fill();

            // Draw margin lines
            const [dashOn, dashOff] = [4, 4];
            cr.setSourceRgba(0.4, 0.6, 0.9, 0.5).setLineWidth(1).setDash([dashOn, dashOff], 0);

            // Top margin line
            cr.moveTo(offsetX, offsetY + marginTop)
                .lineTo(offsetX + pageWidth, offsetY + marginTop)
                .stroke();

            // Bottom margin line
            cr.moveTo(offsetX, offsetY + pageHeight - marginBottom)
                .lineTo(offsetX + pageWidth, offsetY + pageHeight - marginBottom)
                .stroke();

            // Left margin line
            cr.moveTo(offsetX + marginLeft, offsetY)
                .lineTo(offsetX + marginLeft, offsetY + pageHeight)
                .stroke();

            // Right margin line
            cr.moveTo(offsetX + pageWidth - marginRight, offsetY)
                .lineTo(offsetX + pageWidth - marginRight, offsetY + pageHeight)
                .stroke();

            cr.setDash([], 0);

            // Draw content area indicator
            const contentX = offsetX + marginLeft;
            const contentY = offsetY + marginTop;
            const contentWidth = pageWidth - marginLeft - marginRight;
            const contentHeight = pageHeight - marginTop - marginBottom;

            if (contentWidth > 0 && contentHeight > 0) {
                // Sample lines to indicate text area
                cr.setSourceRgba(0.6, 0.6, 0.6, 0.4);
                const lineSpacing = 8;
                const lineCount = Math.floor(contentHeight / lineSpacing);
                for (let i = 0; i < Math.min(lineCount, 20); i++) {
                    const y = contentY + 10 + i * lineSpacing;
                    const lineWidth = contentWidth * (0.7 + Math.random() * 0.25);
                    cr.rectangle(contentX + 5, y, lineWidth - 10, 3);
                }
                cr.fill();
            }

            // Draw orientation indicator
            cr.setSourceRgb(0.3, 0.5, 0.8).setLineWidth(2);
            const arrowX = offsetX + 15;
            const arrowY = offsetY + 15;
            cr.moveTo(arrowX, arrowY + 15)
                .lineTo(arrowX, arrowY)
                .lineTo(arrowX + 5, arrowY + 5)
                .moveTo(arrowX, arrowY)
                .lineTo(arrowX - 5, arrowY + 5)
                .stroke();
        },
        [effectiveWidth, effectiveHeight, topMargin, bottomMargin, leftMargin, rightMargin],
    );

    useEffect(() => {
        if (previewRef.current) {
            previewRef.current.setDrawFunc(drawPreview);
        }
    }, [drawPreview]);

    const handleShowPageSetupDialog = async () => {
        try {
            const printDialog = new Gtk.PrintDialog();
            printDialog.setTitle("Page Setup");
            printDialog.setModal(true);

            // Set initial page setup
            const pageSetup = new Gtk.PageSetup();
            pageSetup.setOrientation(orientation);
            pageSetup.setTopMargin(topMargin, Gtk.Unit.MM);
            pageSetup.setBottomMargin(bottomMargin, Gtk.Unit.MM);
            pageSetup.setLeftMargin(leftMargin, Gtk.Unit.MM);
            pageSetup.setRightMargin(rightMargin, Gtk.Unit.MM);
            printDialog.setPageSetup(pageSetup);

            const setup = await printDialog.setupAsync(app.getActiveWindow() ?? undefined);
            const newPageSetup = setup.getPageSetup();

            if (newPageSetup) {
                // Update state from dialog result
                setOrientation(newPageSetup.getOrientation());
                setTopMargin(newPageSetup.getTopMargin(Gtk.Unit.MM));
                setBottomMargin(newPageSetup.getBottomMargin(Gtk.Unit.MM));
                setLeftMargin(newPageSetup.getLeftMargin(Gtk.Unit.MM));
                setRightMargin(newPageSetup.getRightMargin(Gtk.Unit.MM));

                const newPaperSize = newPageSetup.getPaperSize();
                const width = newPaperSize.getWidth(Gtk.Unit.MM);
                const height = newPaperSize.getHeight(Gtk.Unit.MM);
                setPaperSize({ name: newPaperSize.getDisplayName(), width, height });

                setLastDialogResult("Page setup applied");
            }
        } catch {
            setLastDialogResult("Dialog cancelled");
        }
    };

    const cyclePaperSize = () => {
        const currentIndex = PAPER_SIZES.findIndex((p) => p.name === paperSize.name);
        const nextIndex = (currentIndex + 1) % PAPER_SIZES.length;
        const nextSize = PAPER_SIZES[nextIndex];
        if (nextSize) setPaperSize(nextSize);
    };

    const cycleOrientation = () => {
        const orientations = [
            Gtk.PageOrientation.PORTRAIT,
            Gtk.PageOrientation.LANDSCAPE,
            Gtk.PageOrientation.REVERSE_PORTRAIT,
            Gtk.PageOrientation.REVERSE_LANDSCAPE,
        ] as const;
        const currentIndex = orientations.indexOf(orientation);
        const nextIndex = (currentIndex + 1) % orientations.length;
        const nextOrientation = orientations[nextIndex];
        if (nextOrientation !== undefined) setOrientation(nextOrientation);
    };

    const resetMargins = () => {
        topMarginAdj.setValue(25.4);
        bottomMarginAdj.setValue(25.4);
        leftMarginAdj.setValue(25.4);
        rightMarginAdj.setValue(25.4);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Page Setup" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkPageSetup stores page layout information including paper size, orientation, and margins. Use GtkPrintDialog to show the system page setup dialog."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24}>
                {/* Page Preview */}
                <GtkFrame label="Preview">
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
                        <GtkLabel
                            label={`${paperSize.name} - ${ORIENTATION_LABELS[orientation]}`}
                            cssClasses={["dim-label", "caption"]}
                        />
                        <GtkLabel
                            label={`${effectiveWidth.toFixed(0)} x ${effectiveHeight.toFixed(0)} mm`}
                            cssClasses={["dim-label", "caption"]}
                        />
                    </GtkBox>
                </GtkFrame>

                {/* Settings */}
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} hexpand>
                    {/* Paper Size */}
                    <GtkFrame label="Paper Size">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={12}
                            marginTop={12}
                            marginBottom={12}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Size:" widthChars={10} xalign={0} />
                                <GtkButton
                                    label={`${paperSize.name} (${paperSize.width} x ${paperSize.height} mm)`}
                                    onClicked={cyclePaperSize}
                                    hexpand
                                />
                            </GtkBox>
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Orientation:" widthChars={10} xalign={0} />
                                <GtkButton
                                    label={ORIENTATION_LABELS[orientation]}
                                    onClicked={cycleOrientation}
                                    hexpand
                                />
                            </GtkBox>
                        </GtkBox>
                    </GtkFrame>

                    {/* Margins */}
                    <GtkFrame label="Margins (mm)">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={12}
                            marginTop={12}
                            marginBottom={12}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Top:" widthChars={8} xalign={0} />
                                <GtkSpinButton adjustment={topMarginAdj} climbRate={1} digits={1} hexpand />
                            </GtkBox>
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Bottom:" widthChars={8} xalign={0} />
                                <GtkSpinButton adjustment={bottomMarginAdj} climbRate={1} digits={1} hexpand />
                            </GtkBox>
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Left:" widthChars={8} xalign={0} />
                                <GtkSpinButton adjustment={leftMarginAdj} climbRate={1} digits={1} hexpand />
                            </GtkBox>
                            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                <GtkLabel label="Right:" widthChars={8} xalign={0} />
                                <GtkSpinButton adjustment={rightMarginAdj} climbRate={1} digits={1} hexpand />
                            </GtkBox>
                            <GtkButton label="Reset Margins" onClicked={resetMargins} halign={Gtk.Align.END} />
                        </GtkBox>
                    </GtkFrame>
                </GtkBox>
            </GtkBox>

            {/* Dialog Actions */}
            <GtkFrame label="Page Setup Dialog">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Use GtkPrintDialog.setup() to show the system page setup dialog. This provides native paper size selection and margin configuration."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkButton
                            label="Show Page Setup Dialog..."
                            onClicked={() => void handleShowPageSetupDialog()}
                        />
                        {lastDialogResult && <GtkLabel label={lastDialogResult} cssClasses={["dim-label"]} />}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* PageSetup API */}
            <GtkFrame label="PageSetup API">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="Key GtkPageSetup methods:" halign={Gtk.Align.START} cssClasses={["heading"]} />
                    <GtkLabel
                        label={`setOrientation(orientation) - Portrait/Landscape
setPaperSize(paperSize) - A4, Letter, etc.
setTopMargin(margin, unit) - Top margin
setBottomMargin(margin, unit) - Bottom margin
setLeftMargin(margin, unit) - Left margin
setRightMargin(margin, unit) - Right margin
getPageWidth(unit) - Width minus margins
getPageHeight(unit) - Height minus margins`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pageSetupDemo: Demo = {
    id: "pagesetup",
    title: "Page Setup",
    description: "Page setup dialog with paper size and margin configuration",
    keywords: [
        "page",
        "setup",
        "paper",
        "size",
        "orientation",
        "margins",
        "GtkPageSetup",
        "GtkPaperSize",
        "print",
        "layout",
    ],
    component: PageSetupDemo,
    sourceCode,
};

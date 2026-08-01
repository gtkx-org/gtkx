import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { waitFor } from "@gtkx/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { configurePrintOperation } from "../../../src/demos/dialogs/print-operation.js";
import { printingDemo } from "../../../src/demos/dialogs/printing.js";
import { renderDemo } from "../../test-utils.js";

const TEMP_DIR = mkdtempSync(join(tmpdir(), "gtkx-print-"));

afterAll(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe("printingDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(printingDemo.id).toBe("printing");
        expect(printingDemo.title).toBe("Printing/Printing");
        expect(printingDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(printingDemo.keywords)).toBe(true);
        expect(typeof printingDemo.sourceCode).toBe("string");
        expect(printingDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(printingDemo.component).toBeTypeOf("function");
        expect(printingDemo.isDialogOnly).toBe(true);
    });

    it("declares an empty keywords list matching the official header", () => {
        expect(printingDemo.keywords).toEqual([]);
    });

    it("includes the actual source code as a non-empty string with PrintOperation usage", () => {
        const source = printingDemo.sourceCode ?? "";
        expect(source).toContain("PrintOperation");
        expect(source).toContain("begin-print");
        expect(source).toContain("draw-page");
    });
});

describe("configurePrintOperation", () => {
    it("returns a PrintOperation with the demo's async, unit, and page-setup defaults", () => {
        const printOp = configurePrintOperation("line one\nline two\nline three");
        expect(printOp).toBeInstanceOf(Gtk.PrintOperation);
        expect(printOp).toHaveObjectProperty("allowAsync", true);
        expect(printOp).toHaveObjectProperty("useFullPage", false);
        expect(printOp).toHaveObjectProperty("embedPageSetup", true);
        const settings = printOp.getPrintSettings();
        expect(settings?.get(Gtk.PRINT_SETTINGS_OUTPUT_BASENAME)).toBe("gtk-demo");
    });

    it("computes a single page in begin-print for a short source", async () => {
        const printOp = configurePrintOperation("one\ntwo\nthree");
        const done = vi.fn();
        printOp.on("done", done);
        printOp.setExportFilename(join(TEMP_DIR, "single-count.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);

        await waitFor(() => {
            expect(done).toHaveBeenCalled();
        });

        expect(printOp).toHaveObjectProperty("nPages", 1);
        expect(printOp).toHaveObjectProperty("nPagesToPrint", 1);
    });

    it("renders exactly one page for a short source via draw-page", async () => {
        const printOp = configurePrintOperation("one\ntwo\nthree");
        const drawPage = vi.fn<(context: Gtk.PrintContext, pageNr: number) => void>();
        const done = vi.fn();
        printOp.on("draw-page", drawPage);
        printOp.on("done", done);
        printOp.setExportFilename(join(TEMP_DIR, "single-draw.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);

        await waitFor(() => {
            expect(done).toHaveBeenCalled();
        });

        expect(drawPage).toHaveBeenCalledTimes(1);
        expect(drawPage.mock.calls[0]?.[1]).toBe(0);
    });

    it("sets the demo's points unit on the print operation", () => {
        const printOp = configurePrintOperation("alpha\nbeta\ngamma");
        expect(printOp).toHaveObjectProperty("unit", Gtk.Unit.POINTS);
    });
});

describe("configurePrintOperation export", () => {
    it("splits an 80-line source across multiple pages, drawing each once with an incrementing pageNr", async () => {
        const source = Array.from({ length: 80 }, (_, i) => `line ${String(i + 1)}`).join("\n");
        const printOp = configurePrintOperation(source);
        const beginPrint = vi.fn();
        const drawPage = vi.fn<(context: Gtk.PrintContext, pageNr: number) => void>();
        const done = vi.fn();
        printOp.on("begin-print", beginPrint);
        printOp.on("draw-page", drawPage);
        printOp.on("done", done);
        printOp.setExportFilename(join(TEMP_DIR, "out.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);

        await waitFor(() => {
            expect(done).toHaveBeenCalled();
        });

        expect(beginPrint).toHaveBeenCalledTimes(1);
        expect(printOp.nPages).toBeGreaterThan(1);
        const pageNrs = drawPage.mock.calls.map((call) => call[1]);
        expect(pageNrs).toHaveLength(printOp.nPages);
        expect(pageNrs).toEqual(Array.from({ length: pageNrs.length }, (_, i) => i));
    });

    it("renders a very long single-page body as one page via draw-page", async () => {
        const longLine = "x".repeat(20_000);
        const printOp = configurePrintOperation(`${longLine}\n${longLine}`);
        const drawPage = vi.fn<(context: Gtk.PrintContext, pageNr: number) => void>();
        const done = vi.fn();
        printOp.on("draw-page", drawPage);
        printOp.on("done", done);
        printOp.setExportFilename(join(TEMP_DIR, "out-wide.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);

        await waitFor(() => {
            expect(done).toHaveBeenCalled();
        });

        expect(drawPage).toHaveBeenCalledTimes(1);
        expect(printOp).toHaveObjectProperty("nPages", 1);
    });
});

describe("PrintingDemo component", () => {
    it("runs the operation in PRINT_DIALOG mode and invokes onClose when the done signal fires", async () => {
        const printSpy = vi
            .spyOn(Gtk.PrintOperation.prototype, "run")
            .mockReturnValue(Gtk.PrintOperationResult.APPLY);

        const onClose = vi.fn();

        try {
            await renderDemo(printingDemo, { onClose });

            await waitFor(() => {
                expect(printSpy).toHaveBeenCalledWith(Gtk.PrintOperationAction.PRINT_DIALOG, expect.anything());
            });

            const printOp = printSpy.mock.contexts[0] as Gtk.PrintOperation;
            printOp.emit("done", Gtk.PrintOperationResult.APPLY);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        } finally {
            printSpy.mockRestore();
        }
    });

    it("presents an alert dialog carrying the error heading and closes when the print operation throws", async () => {
        const printSpy = vi.spyOn(Gtk.PrintOperation.prototype, "run").mockImplementation(() => {
            throw new Error("print backend unavailable");
        });

        const presentSpy = vi.spyOn(Adw.AlertDialog.prototype, "present").mockImplementation((): void => undefined);
        const onClose = vi.fn();

        try {
            await renderDemo(printingDemo, { onClose });

            await waitFor(() => {
                expect(presentSpy).toHaveBeenCalled();
            });

            const dialog = presentSpy.mock.contexts[0] as Adw.AlertDialog;
            expect(dialog.getHeading()).toContain("print backend unavailable");

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled();
            });
        } finally {
            presentSpy.mockRestore();
            printSpy.mockRestore();
        }
    });
});

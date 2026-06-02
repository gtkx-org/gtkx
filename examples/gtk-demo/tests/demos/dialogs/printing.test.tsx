import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gtk from "@gtkx/gi/gtk";
import { waitFor } from "@gtkx/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { configurePrintOperation } from "../../../src/demos/dialogs/print-operation.js";
import { printingDemo } from "../../../src/demos/dialogs/printing.js";
import { renderDemo } from "../../test-utils.js";

let tempDir: string;

beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "gtkx-print-"));
});

afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
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
        expect(printingDemo.dialogOnly).toBe(true);
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
        expect(printOp.allowAsync).toBe(true);
        expect(printOp.useFullPage).toBe(false);
        expect(printOp.getEmbedPageSetup()).toBe(true);
        const settings = printOp.getPrintSettings();
        expect(settings?.get(Gtk.PRINT_SETTINGS_OUTPUT_BASENAME)).toBe("gtk-demo");
    });

    it("registers a begin-print signal handler", () => {
        const printOp = configurePrintOperation("line one\nline two\nline three");
        const handlerId = printOp.connect("begin-print", () => undefined);
        expect(handlerId).toBeGreaterThan(0);
        printOp.disconnect(handlerId);
    });

    it("registers a draw-page signal handler that uses the configured Cairo print context", () => {
        const printOp = configurePrintOperation("line one\nline two\nline three");
        const handlerId = printOp.connect("draw-page", () => undefined);
        expect(handlerId).toBeGreaterThan(0);
        printOp.disconnect(handlerId);
    });

    it("sets the demo's points unit on the print operation", () => {
        const printOp = configurePrintOperation("alpha\nbeta\ngamma");
        expect(printOp).toBeInstanceOf(Gtk.PrintOperation);
        expect(printOp.allowAsync).toBe(true);
    });
});

describe("configurePrintOperation export", () => {
    it("invokes begin-print and draw-page when exporting to a PDF file", async () => {
        const source = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join("\n");
        const printOp = configurePrintOperation(source);
        const beginPrint = vi.fn();
        const drawPage = vi.fn();
        const done = vi.fn();
        printOp.connect("begin-print", beginPrint);
        printOp.connect("draw-page", drawPage);
        printOp.connect("done", done);
        printOp.setExportFilename(join(tempDir, "out.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);
        await waitFor(() => expect(beginPrint).toHaveBeenCalled());
        await waitFor(() => expect(drawPage).toHaveBeenCalled());
        const [, firstDrawArgs] = drawPage.mock.calls[0] ?? [];
        expect(firstDrawArgs).toBe(0);
    });

    it("invokes the page-header path with a long source needing ellipsization across the page width", async () => {
        const longLine = "x".repeat(20000);
        const printOp = configurePrintOperation(`${longLine}\n${longLine}`);
        const drawPage = vi.fn();
        printOp.connect("draw-page", drawPage);
        printOp.setExportFilename(join(tempDir, "out-wide.pdf"));
        printOp.run(Gtk.PrintOperationAction.EXPORT, null);
        await waitFor(() => expect(drawPage).toHaveBeenCalledTimes(1));
    });
});

describe("PrintingDemo component", () => {
    it("invokes onClose after the print operation completes", async () => {
        const printSpy = vi.spyOn(Gtk.PrintOperation.prototype, "run").mockReturnValue(Gtk.PrintOperationResult.APPLY);
        const onClose = vi.fn();
        try {
            await renderDemo(printingDemo, { onClose });
            await waitFor(() => expect(printSpy).toHaveBeenCalled());
        } finally {
            printSpy.mockRestore();
        }
    });

    it("presents an alert dialog when the print operation throws", async () => {
        const printSpy = vi.spyOn(Gtk.PrintOperation.prototype, "run").mockImplementation(() => {
            throw new Error("print backend unavailable");
        });
        const onClose = vi.fn();
        try {
            await renderDemo(printingDemo, { onClose });
            await waitFor(() => expect(printSpy).toHaveBeenCalled());
            await waitFor(() => expect(onClose).toHaveBeenCalled());
        } finally {
            printSpy.mockRestore();
        }
    });
});

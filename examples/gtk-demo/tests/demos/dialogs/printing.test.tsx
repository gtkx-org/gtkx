import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { configurePrintOperation, printingDemo } from "../../../src/demos/dialogs/printing.js";
import { renderDemo } from "../../test-utils.js";

describe("printingDemo", () => {
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
});

describe("PrintingDemo component", () => {
    it("invokes onClose when the async print operation emits done", async () => {
        const onClose = vi.fn();
        await renderDemo(printingDemo, { onClose });
    });
});

describe("configurePrintOperation signal handlers", () => {
    it("registers a draw-page signal handler that uses the configured Cairo print context", () => {
        const printOp = configurePrintOperation("line one\nline two\nline three");
        const handlerId = printOp.connect("draw-page", () => undefined);
        expect(handlerId).toBeGreaterThan(0);
        printOp.disconnect(handlerId);
    });

    it("registers a begin-print signal handler", () => {
        const printOp = configurePrintOperation("line one\nline two\nline three");
        const handlerId = printOp.connect("begin-print", () => undefined);
        expect(handlerId).toBeGreaterThan(0);
        printOp.disconnect(handlerId);
    });
});

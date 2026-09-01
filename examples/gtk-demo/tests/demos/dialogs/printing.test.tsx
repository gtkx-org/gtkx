import * as Gtk from "@gtkx/gi/gtk";
import { waitFor } from "@gtkx/testing";
import { mkdtempDisposableSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configurePrintOperation } from "../../../src/demos/dialogs/print-operation.js";

describe("printingDemo", () => {
    it("exports a multipage source as a PDF", async () => {
        using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-print-"));
        const source = Array.from({ length: 80 }, (_, index) => `line ${String(index + 1)}`).join("\n");
        const printOperation = configurePrintOperation(source);
        let isDone = false;
        const output = join(temporary.path, "out.pdf");
        printOperation.on("done", () => {
            isDone = true;
        });
        printOperation.setExportFilename(output);
        printOperation.run(Gtk.PrintOperationAction.EXPORT, null);

        await waitFor(() => {
            expect(isDone).toBe(true);
        });

        expect(readFileSync(output).subarray(0, 4).toString()).toBe("%PDF");
    });
});

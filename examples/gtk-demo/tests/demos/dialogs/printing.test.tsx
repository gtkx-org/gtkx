import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { mkdtempDisposableSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PrintOperation } from "../../../src/demos/dialogs/print-operation.js";
import { printingDemo } from "../../../src/demos/dialogs/printing.js";
import { findAddedWindow } from "../../native-dialogs.js";
import { renderDemo } from "../../test-utils.js";

const longSource = Array.from({ length: 80 }, (_, index) => `line ${String(index + 1)}`).join("\n");

describe("printingDemo component lifecycle", () => {
    it("closes the native print dialog and completes once after cancellation", async () => {
        let completions = 0;
        await renderDemo(printingDemo, { onClose: () => {
            completions += 1;
        } });
        const parent = screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.ApplicationWindow });
        const dialog = await findAddedWindow(new Set([parent]));
        expect(dialog.getTitle()).toBe("Print");
        expect(dialog.getTransientFor()).toBe(parent);
        expect(completions).toBe(0);
        await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Cancel" }));
        await waitFor(() => {
            expect(Gtk.Window.listToplevels()).not.toContain(dialog);
            expect(completions).toBe(1);
        });
        expect(parent).toBeVisible();
    });
});

describe("PrintOperation exports", () => {
    it.each([
        { name: "empty source", source: "", pages: 1 },
        { name: "multipage source", source: longSource, pages: 2 },
    ])("exports $name to PDF and reports its printed pages", async ({ source, pages }) => {
        using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-print-"));
        const completions: { result: Gtk.PrintOperationResult; pages: number }[] = [];
        const output = join(temporary.path, "out.pdf");
        await render(
            <PrintOperation
                source={source}
                action={Gtk.PrintOperationAction.EXPORT}
                parent={null}
                exportFilename={output}
                onDone={(result, operation) => {
                    completions.push({ result, pages: operation.getNPagesToPrint() });
                }}
            />,
        );
        await waitFor(() => {
            expect(completions).toEqual([{ result: Gtk.PrintOperationResult.APPLY, pages }]);
        });

        expect(readFileSync(output).subarray(0, 4).toString()).toBe("%PDF");
    });

    it("propagates an export failure when no error callback handles it", async () => {
        using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-print-error-"));
        const output = join(temporary.path, "missing", "out.pdf");
        await expect(render(
            <PrintOperation
                source="A line"
                action={Gtk.PrintOperationAction.EXPORT}
                parent={null}
                exportFilename={output}
            />,
        )).rejects.toThrow();
    });

    it("reports an export failure to its error callback", async () => {
        using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-print-error-callback-"));
        const output = join(temporary.path, "missing", "out.pdf");
        const errors: unknown[] = [];
        const completions: Gtk.PrintOperationResult[] = [];
        await render(
            <PrintOperation
                source="A line"
                action={Gtk.PrintOperationAction.EXPORT}
                parent={null}
                exportFilename={output}
                onError={(error) => {
                    errors.push(error);
                }}
                onDone={(result) => {
                    completions.push(result);
                }}
            />,
        );
        await waitFor(() => {
            expect(errors).toHaveLength(1);
            expect(completions).toEqual([Gtk.PrintOperationResult.ERROR]);
        });
    });
});

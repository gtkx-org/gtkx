import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";
import { renderDemo } from "../../test-utils.js";

describe("pageSetupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(pageSetupDemo.id).toBe("pagesetup");
        expect(pageSetupDemo.title).toBe("Printing/Page Setup");
        expect(pageSetupDemo.description.length).toBeGreaterThan(0);
        expect(pageSetupDemo.keywords).toContain("GtkPageSetup");
        expect(typeof pageSetupDemo.sourceCode).toBe("string");
        expect(pageSetupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pageSetupDemo.component).toBeTypeOf("function");
        expect(pageSetupDemo.dialogOnly).toBe(true);
    });
});

describe("pageSetupDemo component lifecycle", () => {
    it("invokes the demo's print dialog and runs onClose when the dialog resolves", async () => {
        const setupSpy = vi.spyOn(Gtk.PrintDialog.prototype, "setup");
        setupSpy.mockResolvedValue(new Gtk.PageSetup() as unknown as Gtk.PrintSetup);
        const onClose = vi.fn();
        try {
            await renderDemo(pageSetupDemo, { onClose });
            await waitFor(() => expect(setupSpy).toHaveBeenCalled());
            await waitFor(() => expect(onClose).toHaveBeenCalled());
        } finally {
            setupSpy.mockRestore();
        }
    });

    it("swallows dialog rejections and still runs onClose", async () => {
        const setupSpy = vi.spyOn(Gtk.PrintDialog.prototype, "setup");
        setupSpy.mockRejectedValue(new Error("dismissed"));
        const onClose = vi.fn();
        try {
            await renderDemo(pageSetupDemo, { onClose });
            await waitFor(() => expect(onClose).toHaveBeenCalled());
        } finally {
            setupSpy.mockRestore();
        }
    });

    it("cancels the in-flight Gio.Cancellable when the demo unmounts", async () => {
        const cancelSpy = vi.spyOn(Gio.Cancellable.prototype, "cancel");
        const setupSpy = vi.spyOn(Gtk.PrintDialog.prototype, "setup");
        setupSpy.mockImplementation(() => new Promise(() => {}));
        try {
            const result = await renderDemo(pageSetupDemo);
            await waitFor(() => expect(setupSpy).toHaveBeenCalled());
            await result.unmount();
            expect(cancelSpy).toHaveBeenCalled();
        } finally {
            setupSpy.mockRestore();
            cancelSpy.mockRestore();
        }
    });
});

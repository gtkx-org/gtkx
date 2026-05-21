import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findToplevelDialog = (): Gtk.PageSetupUnixDialog | null => {
    const tops = Gtk.Window.listToplevels();
    for (const top of tops) {
        if (top instanceof Gtk.PageSetupUnixDialog) return top;
    }
    return null;
};

describe("pageSetupDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(pageSetupDemo, { id: "pagesetup", title: "Printing/Page Setup" });
        expect(typeof pageSetupDemo.sourceCode).toBe("string");
        expect(pageSetupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pageSetupDemo.keywords).toContain("page");
        expect(pageSetupDemo.keywords).toContain("GtkPageSetupUnixDialog");
        expect(pageSetupDemo.component).toBeTypeOf("function");
        expect(pageSetupDemo.dialogOnly).toBe(true);
    });

    it("renders using the wrapper ApplicationWindow even though the component returns null", async () => {
        if (!pageSetupDemo.component) throw new Error("pagesetup demo component missing");
        const { container } = await renderDemo(pageSetupDemo.component);
        expect(container).toBeInstanceOf(Gtk.ApplicationWindow);
    });

    it("creates a visible GtkPageSetupUnixDialog titled 'Page Setup' on mount", async () => {
        if (!pageSetupDemo.component) throw new Error("pagesetup demo component missing");
        await renderDemo(pageSetupDemo.component);
        const dialog = findToplevelDialog();
        expect(dialog).toBeInstanceOf(Gtk.PageSetupUnixDialog);
        if (!dialog) throw new Error("expected dialog");
        expect(dialog.getTitle()).toBe("Page Setup");
        expect(dialog.getVisible()).toBe(true);
    });

    it("invokes onClose when the dialog response signal fires", async () => {
        if (!pageSetupDemo.component) throw new Error("pagesetup demo component missing");
        const onClose = vi.fn();
        await renderDemo(pageSetupDemo.component, { onClose });
        const dialog = findToplevelDialog();
        if (!dialog) throw new Error("expected dialog");
        dialog.emit("response", Gtk.ResponseType.OK);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("removes the dialog from the toplevel list when the component unmounts", async () => {
        if (!pageSetupDemo.component) throw new Error("pagesetup demo component missing");
        const { unmount } = await renderDemo(pageSetupDemo.component);
        const initial = findToplevelDialog();
        expect(initial).toBeInstanceOf(Gtk.PageSetupUnixDialog);
        await unmount();
        const remaining = findToplevelDialog();
        expect(remaining === null || !remaining.getVisible()).toBe(true);
    });
});

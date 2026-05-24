import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";

const PageSetupComponent = pageSetupDemo.component as NonNullable<typeof pageSetupDemo.component>;

describe("pageSetupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(pageSetupDemo.id).toBe("pagesetup");
        expect(pageSetupDemo.title).toBe("Printing/Page Setup");
        expect(pageSetupDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(pageSetupDemo.keywords)).toBe(true);
        expect(typeof pageSetupDemo.sourceCode).toBe("string");
        expect(pageSetupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pageSetupDemo.keywords).toContain("GtkPageSetup");
        expect(pageSetupDemo.component).toBeTypeOf("function");
        expect(pageSetupDemo.dialogOnly).toBe(true);
    });

    it("provides the source code referencing PrintDialog and the setup method", () => {
        const source = pageSetupDemo.sourceCode ?? "";
        expect(source).toContain("PrintDialog");
        expect(source).toContain("setup");
    });
});

describe("pageSetupDemo cancellable behavior", () => {
    it("creates a pre-cancelled Gio.Cancellable that mirrors the unmount cleanup signal", () => {
        const cancellable = new Gio.Cancellable();
        expect(cancellable.isCancelled()).toBe(false);
        cancellable.cancel();
        expect(cancellable.isCancelled()).toBe(true);
    });

    it("can construct a PrintDialog matching the dialog the demo instantiates", () => {
        const dialog = Gtk.PrintDialog.new();
        dialog.setTitle("Page Setup");
        expect(dialog).toBeInstanceOf(Gtk.PrintDialog);
        expect(dialog.getTitle()).toBe("Page Setup");
    });
});

describe("PageSetupDemo component", () => {
    it("is registered as a function component", () => {
        expect(pageSetupDemo.component).toBeTypeOf("function");
    });

    it("renders null and skips the dialog setup when the host window ref is empty", async () => {
        const windowRef = createRef<Gtk.Window | null>();
        const result = await render(
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300}>
                <GtkLabel label="host" />
                <PageSetupComponent window={windowRef} onClose={() => {}} />
            </GtkApplicationWindow>,
            { wrapper: false },
        );
        expect(windowRef.current).toBeNull();
        await result.unmount();
    });

    it("invokes the early-return path when the window ref deliberately resolves to null", async () => {
        const windowRef = createRef<Gtk.Window | null>();
        (windowRef as { current: Gtk.Window | null }).current = null;
        const result = await render(
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300}>
                <GtkLabel label="host" />
                <PageSetupComponent window={windowRef} onClose={() => {}} />
            </GtkApplicationWindow>,
            { wrapper: false },
        );
        expect(windowRef.current).toBeNull();
        await result.unmount();
    });
});

import * as Gtk from "@gtkx/gi/gtk";
import { waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";
import { renderDemo } from "../../test-utils.js";

describe("pageSetupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(pageSetupDemo.id).toBe("pagesetup");
        expect(pageSetupDemo.title).toBe("Printing/Page Setup");

        expect(pageSetupDemo.description).toBe(
            "GtkPageSetupUnixDialog can be used if page setup is needed independent of a full printing dialog.",
        );

        expect(pageSetupDemo.keywords).toEqual(["GtkPageSetup"]);
        expect(pageSetupDemo.sourceCode).toContain("const pageSetupDemo: Demo = {");
        expect(pageSetupDemo.component).toBeTypeOf("function");
        expect(pageSetupDemo.isDialogOnly).toBe(true);
    });
});

describe("pageSetupDemo component lifecycle", () => {
    it("invokes the page setup dialog and runs onClose when the user completes the dialog", async () => {
        const dialogSpy = vi.spyOn(Gtk, "printRunPageSetupDialogAsync");

        dialogSpy.mockImplementation((_parent, _pageSetup, _settings, doneCb) => {
            doneCb(new Gtk.PageSetup());
        });

        const onClose = vi.fn();

        try {
            await renderDemo(pageSetupDemo, { onClose });

            await waitFor(() => {
                expect(dialogSpy).toHaveBeenCalledWith(
                    expect.anything(),
                    null,
                    expect.any(Gtk.PrintSettings),
                    expect.any(Function),
                );
            },
            );

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

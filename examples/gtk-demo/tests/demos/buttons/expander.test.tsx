import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { expanderDemo } from "../../../src/demos/buttons/expander.js";
import { act, renderDemo, screen, waitFor } from "../../test-utils.js";

describe("expanderDemo", () => {
    it("exposes the expected metadata", () => {
        expect(expanderDemo.id).toBe("expander");
        expect(expanderDemo.title).toBe("Expander");
        expect(typeof expanderDemo.sourceCode).toBe("string");
    });

    it("renders the Details expander", async () => {
        await renderDemo(expanderDemo);
        const expander = (await screen.findByName("expander")) as Gtk.Expander;
        expect(expander).toBeInstanceOf(Gtk.Expander);
        expect(expander.getLabel()).toBe("Details:");
        expect(expander.getExpanded()).toBe(false);
    });

    it("makes the host window resizable when the expander is expanded", async () => {
        const { window } = await renderDemo(expanderDemo);
        const expander = (await screen.findByName("expander")) as Gtk.Expander;
        const win = window.current;
        if (!win) throw new Error("window ref missing");
        win.setResizable(false);
        await act(() => expander.setExpanded(true));
        await waitFor(() => expect(win.getResizable()).toBe(true));
        await act(() => expander.setExpanded(false));
        await waitFor(() => expect(win.getResizable()).toBe(false));
    });
});

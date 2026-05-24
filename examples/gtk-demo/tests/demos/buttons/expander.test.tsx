import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { expanderDemo } from "../../../src/demos/buttons/expander.js";
import { renderDemo } from "../../test-utils.js";

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
        await renderDemo(expanderDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const expander = (await screen.findByName("expander")) as Gtk.Expander;
        window.setResizable(false);
        await act(() => expander.setExpanded(true));
        await waitFor(() => expect(window.getResizable()).toBe(true));
        await act(() => expander.setExpanded(false));
        await waitFor(() => expect(window.getResizable()).toBe(false));
    });
});

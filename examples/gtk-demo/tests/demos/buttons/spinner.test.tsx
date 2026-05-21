import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinnerDemo } from "../../../src/demos/buttons/spinner.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("spinnerDemo", () => {
    it("exposes the expected metadata", () => {
        expect(spinnerDemo.id).toBe("spinner");
        expect(spinnerDemo.title).toBe("Spinner");
        expect(typeof spinnerDemo.sourceCode).toBe("string");
    });

    it("renders Play/Stop buttons and toggles via clicks", async () => {
        await renderDemo(spinnerDemo);
        const play = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Play" });
        const stop = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop" });
        await fireEvent(stop, "clicked");
        await fireEvent(play, "clicked");
        expect(play).toBeInstanceOf(Gtk.Button);
    });
});

import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton } from "@gtkx/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "../src/index.js";

afterEach(async () => {
    await cleanup();
});

describe("fireEvent", () => {
    it("emits clicked signal on button", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        await fireEvent(button, "clicked");

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("emits multiple signals in sequence", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        await fireEvent(button, "clicked");
        await fireEvent(button, "clicked");
        await fireEvent(button, "clicked");

        expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it("returns a promise that resolves after signal emission", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        const promise = fireEvent(button, "clicked");

        expect(promise).toBeInstanceOf(Promise);
        await promise;
        expect(handleClick).toHaveBeenCalled();
    });
});

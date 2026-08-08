import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";

describe("screen binding", () => {
    it("routes queries through the global toplevel scope", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const all = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: /First|Second/ });
        expect(button).toBeDefined();
        expect(all).toHaveLength(2);
    });

    it("throws when no render has been performed", async () => {
        await cleanup();

        expect(() => screen.findByRole(Gtk.AccessibleRole.BUTTON, { timeout: 100 })).toThrow(
            "No render has been performed",
        );
    });
});

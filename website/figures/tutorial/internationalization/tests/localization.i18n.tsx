import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import schema from "../data/dev.gtkx.Notes.gschema.xml";
import { App } from "../src/app.js";

const notesFolder = (): string =>
    Gio.Settings.new(schema.id).getString("folder");

describe("Notes in French", () => {
    it("renders translated controls", async () => {
        await render(<App />, { container: rootElement });

        expect(
            await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
                name: "Nouvelle note (Ctrl+N)",
            }),
        ).toBeDefined();
        expect(
            await screen.findByPlaceholderText("Rechercher dans les notes"),
        ).toBeDefined();
    });

    it("uses French plural forms", async () => {
        await render(<App />, { container: rootElement });

        expect(await screen.findByText("2 notes")).toBeDefined();

        rmSync(join(notesFolder(), "Groceries.md"));
        expect(await screen.findByText("1 note")).toBeDefined();

        rmSync(join(notesFolder(), "Reading list.md"));
        expect(await screen.findByText("0 note")).toBeDefined();
    });

    it("interpolates values into translated messages", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(
            await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, {
                name: "Groceries",
            }),
        );
        await userEvent.click(
            await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
                name: "Menu de la note",
            }),
        );
        await userEvent.click(
            await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, {
                name: "Mettre à la corbeille",
            }),
        );

        expect(
            await screen.findByText("« Groceries » a été mise à la corbeille"),
        ).toBeDefined();
    });
});

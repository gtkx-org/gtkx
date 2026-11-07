import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import * as Adw from "@gtkx/gi/adw";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import schema from "../data/dev.gtkx.Notes.gschema.xml";
import { App } from "../src/app.js";

const notesFolder = (): string => Gio.Settings.new(schema.id).getString("folder");

const noteRows = (): Promise<Gtk.Widget[]> => screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);

const openNote = async (name: string): Promise<Gtk.TextView> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name }));

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text", as: Gtk.TextView });
};

const editorText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();

    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
};

describe("Notes", () => {
    it("lists the Markdown files in the folder, newest first", async () => {
        await render(<App />, { container: rootElement });

        const [first, second] = await noteRows();
        expect(first).toHaveAccessibleName("Reading list");
        expect(second).toHaveAccessibleName("Groceries");
    });

    it("opens a note in the editor", async () => {
        await render(<App />, { container: rootElement });

        const editor = await openNote("Groceries");

        expect(editorText(editor)).toBe(readFileSync(join(notesFolder(), "Groceries.md"), "utf8"));
    });

    it("saves what is typed to the note's file", async () => {
        await render(<App />, { container: rootElement });

        const editor = await openNote("Groceries");
        await userEvent.type(editor, "- Rice\n");

        await waitFor(() => {
            expect(readFileSync(join(notesFolder(), "Groceries.md"), "utf8")).toContain("- Rice");
        });
    });

    it("shows notes added and removed outside the app", async () => {
        await render(<App />, { container: rootElement });
        await noteRows();

        writeFileSync(join(notesFolder(), "Ideas.md"), "A notes app over plain files\n");
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Ideas" })).toBeDefined();

        rmSync(join(notesFolder(), "Groceries.md"));
        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Groceries" })).toBeNull();
        });
    });

    it("reloads an open note changed outside the app", async () => {
        await render(<App />, { container: rootElement });

        const editor = await openNote("Groceries");
        writeFileSync(join(notesFolder(), "Groceries.md"), "# Groceries\n\n- Bread\n");

        await waitFor(() => {
            expect(editorText(editor)).toBe("# Groceries\n\n- Bread\n");
        });
    });

    it("creates an untitled note and opens it", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Note (Ctrl+N)" }));

        const editor = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text", as: Gtk.TextView });
        expect(editorText(editor)).toBe("");
        expect(existsSync(join(notesFolder(), "Untitled.md"))).toBe(true);
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Untitled" })).toBeDefined();
    });

    it("numbers a new note when the name is taken", async () => {
        writeFileSync(join(notesFolder(), "Untitled.md"), "");
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Note (Ctrl+N)" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Untitled 2" })).toBeDefined();
        expect(readFileSync(join(notesFolder(), "Untitled.md"), "utf8")).toBe("");
    });

    it("renames the open note's file", async () => {
        await render(<App />, { container: rootElement });
        const text = readFileSync(join(notesFolder(), "Groceries.md"), "utf8");

        await openNote("Groceries");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Note Menu" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Rename…" }));
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note name" });
        await userEvent.clear(entry);
        await userEvent.type(entry, "Shopping{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Shopping" })).toBeDefined();
        expect(readFileSync(join(notesFolder(), "Shopping.md"), "utf8")).toBe(text);
        expect(existsSync(join(notesFolder(), "Groceries.md"))).toBe(false);
    });

    it("won't rename a note to a name already taken", async () => {
        await render(<App />, { container: rootElement });

        await openNote("Groceries");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Note Menu" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Rename…" }));
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note name" });
        await userEvent.clear(entry);
        await userEvent.type(entry, "Reading list");

        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Rename" })).toBeDisabled();
    });

    it("moves a note to the trash and undoes it", async () => {
        await render(<App />, { container: rootElement });
        const path = join(notesFolder(), "Groceries.md");
        const text = readFileSync(path, "utf8");

        await openNote("Groceries");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Note Menu" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Move to Trash" }));

        expect(await screen.findByText("“Groceries” moved to Trash")).toBeDefined();
        expect(existsSync(path)).toBe(false);
        expect(readdirSync(join(process.env.XDG_DATA_HOME ?? "", "Trash", "files"))).toContain("Groceries.md");
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Groceries" })).toBeNull();

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Undo" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Groceries" })).toBeDefined();
        expect(readFileSync(path, "utf8")).toBe(text);
    });

    it("follows the style chosen in Preferences", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Preferences" }));
        await userEvent.selectOptions(await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX, { name: "Style" }), 2);

        await waitFor(() => {
            expect(Adw.StyleManager.getDefault().getColorScheme()).toBe(Adw.ColorScheme.FORCE_DARK);
        });
    });

    it("offers to create the first note in an empty folder", async () => {
        rmSync(notesFolder(), { recursive: true });
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Note" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Untitled" })).toBeDefined();
        expect(existsSync(join(notesFolder(), "Untitled.md"))).toBe(true);
    });
});

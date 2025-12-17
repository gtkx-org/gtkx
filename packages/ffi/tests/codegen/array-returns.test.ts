import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("array returns", () => {
    describe("string arrays", () => {
        it("returns empty array when no CSS classes", () => {
            const button = new Gtk.Button();
            const classes = button.getCssClasses();
            expect(Array.isArray(classes)).toBe(true);
        });

        it("returns CSS classes as array", () => {
            const button = new Gtk.Button();
            button.addCssClass("custom-class");
            const classes = button.getCssClasses();
            expect(classes).toContain("custom-class");
        });

        it("returns AboutDialog artists as array", () => {
            const dialog = new Gtk.AboutDialog();
            const artists = dialog.getArtists();
            expect(Array.isArray(artists)).toBe(true);
        });

        it("returns AboutDialog authors as array", () => {
            const dialog = new Gtk.AboutDialog();
            const authors = dialog.getAuthors();
            expect(Array.isArray(authors)).toBe(true);
        });

        it("returns AboutDialog documenters as array", () => {
            const dialog = new Gtk.AboutDialog();
            const documenters = dialog.getDocumenters();
            expect(Array.isArray(documenters)).toBe(true);
        });
    });

    describe("object arrays", () => {
        it("returns toplevels as widget array", () => {
            const toplevels = Gtk.Window.listToplevels();
            expect(Array.isArray(toplevels)).toBe(true);
        });

        it("returns mnemonic labels as array", () => {
            const button = new Gtk.Button();
            const labels = button.listMnemonicLabels();
            expect(Array.isArray(labels)).toBe(true);
        });
    });

    describe("setting arrays", () => {
        it("sets CSS classes from array", () => {
            const button = new Gtk.Button();
            button.setCssClasses(["class-a", "class-b"]);
            const classes = button.getCssClasses();
            expect(classes).toContain("class-a");
            expect(classes).toContain("class-b");
        });

        it("sets AboutDialog artists from array", () => {
            const dialog = new Gtk.AboutDialog();
            dialog.setArtists(["Artist One", "Artist Two"]);
            const artists = dialog.getArtists();
            expect(artists).toContain("Artist One");
            expect(artists).toContain("Artist Two");
        });
    });
});

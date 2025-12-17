import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("async methods", () => {
    describe("promise-returning methods", () => {
        it("has async choose method on AlertDialog", () => {
            const dialog = new Gtk.AlertDialog();
            expect(typeof dialog.choose).toBe("function");
        });

        it("has async open method on FileDialog", () => {
            const dialog = new Gtk.FileDialog();
            expect(typeof dialog.open).toBe("function");
        });

        it("has async save method on FileDialog", () => {
            const dialog = new Gtk.FileDialog();
            expect(typeof dialog.save).toBe("function");
        });

        it("has async chooseRgba method on ColorDialog", () => {
            const dialog = new Gtk.ColorDialog();
            expect(typeof dialog.chooseRgba).toBe("function");
        });

        it("has async chooseFont method on FontDialog", () => {
            const dialog = new Gtk.FontDialog();
            expect(typeof dialog.chooseFont).toBe("function");
        });
    });

    describe("async method signatures", () => {
        it("async method exists on PrintDialog", () => {
            const dialog = new Gtk.PrintDialog();
            expect(typeof dialog.print).toBe("function");
        });

        it("async method exists on UriLauncher", () => {
            const launcher = new Gtk.UriLauncher("https://example.com");
            expect(typeof launcher.launch).toBe("function");
        });

        it("async method exists on FileLauncher", () => {
            const launcher = new Gtk.FileLauncher();
            expect(typeof launcher.launch).toBe("function");
        });
    });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveLibraries } from "../../src/codegen/library-resolver.js";

describe("resolveLibraries", () => {
    it("returns the default GTK + libadwaita + GtkSource + WebKit set when libraries is omitted", () => {
        expect(resolveLibraries(undefined, [])).toEqual(["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"]);
    });

    it("merges an explicit list with the defaults, deduplicating overlaps", () => {
        expect(resolveLibraries(["WebKit-6.0", "Soup-3.0"], [])).toEqual([
            "Gtk-4.0",
            "Adw-1",
            "GtkSource-5",
            "WebKit-6.0",
            "Soup-3.0",
        ]);
    });

    it('expands "*" to the namespaces discovered on the search path', () => {
        const dir = mkdtempSync(join(tmpdir(), "gir-resolve-"));
        try {
            writeFileSync(join(dir, "Gtk-4.0.gir"), "");
            writeFileSync(join(dir, "Adw-1.gir"), "");

            expect(resolveLibraries("*", [dir])).toEqual(["Adw-1", "Gtk-4.0"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('throws when "*" matches no .gir files', () => {
        expect(() => resolveLibraries("*", [])).toThrow(/matched no \.gir files/);
    });
});

describe('resolveLibraries — "*" GIR discovery', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "gir-discover-"));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("returns sorted namespace identifiers for matching .gir files", () => {
        writeFileSync(join(dir, "Gtk-4.0.gir"), "");
        writeFileSync(join(dir, "Adw-1.gir"), "");

        expect(resolveLibraries("*", [dir])).toEqual(["Adw-1", "Gtk-4.0"]);
    });

    it("skips files that are not .gir or not Name-Version shaped", () => {
        writeFileSync(join(dir, "Gtk-4.0.gir"), "");
        writeFileSync(join(dir, "notes.txt"), "");
        writeFileSync(join(dir, "weird name.gir"), "");
        writeFileSync(join(dir, "NoVersion.gir"), "");

        expect(resolveLibraries("*", [dir])).toEqual(["Gtk-4.0"]);
    });

    it("keeps only the highest version when a namespace appears multiple times", () => {
        writeFileSync(join(dir, "Gtk-3.0.gir"), "");
        writeFileSync(join(dir, "Gtk-4.0.gir"), "");
        writeFileSync(join(dir, "Soup-2.4.gir"), "");
        writeFileSync(join(dir, "Soup-3.0.gir"), "");

        expect(resolveLibraries("*", [dir])).toEqual(["Gtk-4.0", "Soup-3.0"]);
    });

    it("deduplicates a namespace found across multiple search directories", () => {
        const other = mkdtempSync(join(tmpdir(), "gir-discover-b-"));
        try {
            writeFileSync(join(dir, "Gtk-4.0.gir"), "");
            writeFileSync(join(other, "Gtk-4.0.gir"), "");

            expect(resolveLibraries("*", [dir, other])).toEqual(["Gtk-4.0"]);
        } finally {
            rmSync(other, { recursive: true, force: true });
        }
    });

    it("skips directories that cannot be read rather than crashing", () => {
        expect(() => resolveLibraries("*", [join(dir, "does-not-exist")])).toThrow(/matched no \.gir files/);
    });
});

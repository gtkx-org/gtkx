import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveLibraries } from "../../src/gir/libraries.js";

const writeEmptyFiles = (dir: string, names: string[]): void => {
    for (const name of names) {
        writeFileSync(join(dir, name), "");
    }
};

const withTempDir = (prefix: string, run: (dir: string) => void): void => {
    const dir = mkdtempSync(join(tmpdir(), prefix));

    try {
        run(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};

describe("resolveLibraries", () => {
    it("returns the GTK-only default when libraries is omitted", () => {
        expect(resolveLibraries(undefined, [])).toEqual(["Gtk-4.0"]);
    });

    it("keeps an explicit list as given, adding Gtk-4.0 when omitted", () => {
        expect(resolveLibraries(["WebKit-6.0", "Soup-3.0"], [])).toEqual(["Gtk-4.0", "WebKit-6.0", "Soup-3.0"]);
    });

    it("does not duplicate Gtk when an explicit list already names it", () => {
        expect(resolveLibraries(["Gtk-4.0", "Adw-1"], [])).toEqual(["Gtk-4.0", "Adw-1"]);
    });

    it('expands "*" to the namespaces discovered on the search path', () => {
        withTempDir("gir-resolve-", (dir) => {
            writeEmptyFiles(dir, ["Gtk-4.0.gir", "Adw-1.gir"]);
            expect(resolveLibraries("*", [dir])).toEqual(["Adw-1", "Gtk-4.0"]);
        });
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
        writeEmptyFiles(dir, ["Gtk-4.0.gir", "Adw-1.gir"]);
        expect(resolveLibraries("*", [dir])).toEqual(["Adw-1", "Gtk-4.0"]);
    });

    it("skips files that are not .gir or not Name-Version shaped", () => {
        writeEmptyFiles(dir, ["Gtk-4.0.gir", "notes.txt", "weird name.gir", "NoVersion.gir"]);
        expect(resolveLibraries("*", [dir])).toEqual(["Gtk-4.0"]);
    });

    it("keeps only the highest version when a namespace appears multiple times", () => {
        writeEmptyFiles(dir, ["Gtk-3.0.gir", "Gtk-4.0.gir", "Soup-2.4.gir", "Soup-3.0.gir"]);
        expect(resolveLibraries("*", [dir])).toEqual(["Gtk-4.0", "Soup-3.0"]);
    });

    it("deduplicates a namespace found across multiple search directories", () => {
        withTempDir("gir-discover-b-", (other) => {
            writeEmptyFiles(dir, ["Gtk-4.0.gir"]);
            writeEmptyFiles(other, ["Gtk-4.0.gir"]);
            expect(resolveLibraries("*", [dir, other])).toEqual(["Gtk-4.0"]);
        });
    });

    it("skips directories that cannot be read rather than crashing", () => {
        expect(() => resolveLibraries("*", [join(dir, "does-not-exist")])).toThrow(/matched no \.gir files/);
    });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    ELEMENTS_FILENAME,
    type GeneratedElement,
    readGeneratedElements,
    renderGeneratedElements,
} from "../../src/store/jsx/generated-elements.js";

const BUTTON: GeneratedElement = { namespace: "Gtk", directory: "gtk", glibName: "GtkButton", isMountable: true };
const WIDGET: GeneratedElement = { namespace: "Gtk", directory: "gtk", glibName: "GtkWidget", isMountable: false };

const FOREIGN_INVENTORIES: [string, unknown][] = [
    ["an empty object", {}],
    ["a package manifest", { version: "1.0.0" }],
    ["null", null],
    ["a bare string", "GtkButton"],
    ["a number", 12],
    ["a map keyed by GLib type name", { GtkButton: BUTTON }],
];

const MALFORMED_INVENTORIES: [string, unknown][] = [
    ...FOREIGN_INVENTORIES,
    ["an entry that is not a record", [null]],
    ["an entry that is a bare string", ["GtkButton"]],
    ["an entry with no GLib type name", [{ namespace: "Gtk", directory: "gtk", isMountable: true }]],
    ["an entry with no namespace", [{ directory: "gtk", glibName: "GtkButton", isMountable: true }]],
    ["an entry with no subexport", [{ namespace: "Gtk", glibName: "GtkButton", isMountable: true }]],
    ["an entry that records no mountability", [{ namespace: "Gtk", directory: "gtk", glibName: "GtkButton" }]],
    ["an entry whose namespace is not a string", [{ ...BUTTON, namespace: 4 }]],
    ["an entry whose mountability is a string", [{ ...BUTTON, isMountable: "true" }]],
    ["one sound entry beside a malformed one", [BUTTON, { ...WIDGET, glibName: null }]],
];

describe("readGeneratedElements", () => {
    let storeDir: string;

    beforeEach(() => {
        storeDir = mkdtempSync(join(tmpdir(), "gtkx-elements-"));
    });

    afterEach(() => {
        rmSync(storeDir, { recursive: true, force: true });
    });

    function writeInventory(elements: GeneratedElement[]): void {
        writeFileSync(join(storeDir, ELEMENTS_FILENAME), renderGeneratedElements(elements));
    }

    function writeStoreFile(content: unknown): void {
        writeFileSync(join(storeDir, ELEMENTS_FILENAME), JSON.stringify(content));
    }

    it("round-trips the inventory written into the store", () => {
        writeInventory([BUTTON, WIDGET]);
        expect(readGeneratedElements(storeDir)).toEqual([BUTTON, WIDGET]);
    });

    it("distinguishes mountable elements from abstract ones", () => {
        writeInventory([BUTTON, WIDGET]);
        const mountableElements = readGeneratedElements(storeDir).filter((element) => element.isMountable);
        expect(mountableElements.map((element) => element.glibName)).toEqual(["GtkButton"]);
    });

    it("returns nothing when the store has no inventory", () => {
        expect(readGeneratedElements(storeDir)).toEqual([]);
    });

    it.each(MALFORMED_INVENTORIES)("reports no inventory when the store file holds %s", (_name, content) => {
        writeStoreFile(content);
        expect(readGeneratedElements(storeDir)).toEqual([]);
    });

    it("reports no inventory when the store file is not JSON", () => {
        writeFileSync(join(storeDir, ELEMENTS_FILENAME), "not json");
        expect(readGeneratedElements(storeDir)).toEqual([]);
    });

    it("hands callers an array they can filter even when another tool wrote the store file", () => {
        writeStoreFile({ version: "1.0.0" });
        expect(readGeneratedElements(storeDir).filter((element) => element.isMountable)).toEqual([]);
    });
});

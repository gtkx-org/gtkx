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

const BUTTON: GeneratedElement = { namespace: "Gtk", directory: "gtk", glibName: "GtkButton", mountable: true };
const WIDGET: GeneratedElement = { namespace: "Gtk", directory: "gtk", glibName: "GtkWidget", mountable: false };

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

    it("round-trips the inventory written into the store", () => {
        writeInventory([BUTTON, WIDGET]);
        expect(readGeneratedElements(storeDir)).toEqual([BUTTON, WIDGET]);
    });

    it("distinguishes mountable elements from abstract ones", () => {
        writeInventory([BUTTON, WIDGET]);
        const mountable = readGeneratedElements(storeDir).filter((element) => element.mountable);
        expect(mountable.map((element) => element.glibName)).toEqual(["GtkButton"]);
    });

    it("returns nothing when the store has no inventory", () => {
        expect(readGeneratedElements(storeDir)).toEqual([]);
    });
});

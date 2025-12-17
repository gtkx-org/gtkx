import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getObjectId } from "../src/index.js";

describe("getObjectId", () => {
    it("returns the native pointer from an object", () => {
        const label = new Gtk.Label("Test");
        const id = getObjectId(label.id);
        expect(id).toBeDefined();
    });
});

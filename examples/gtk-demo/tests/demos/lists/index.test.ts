import { describe, expect, it } from "vitest";
import { listsDemos } from "../../../src/demos/lists/index.js";

describe("listsDemos", () => {
    it("exposes the expected lists demos in declared order", () => {
        expect(listsDemos.map((d) => d.id)).toEqual([
            "listbox",
            "listbox-controls",
            "listview-applauncher",
            "listview-colors",
            "listview-filebrowser",
            "listview-selections",
            "listview-settings",
            "listview-settings2",
            "listview-ucd",
            "listview-weather",
            "listview-words",
        ]);
    });
});

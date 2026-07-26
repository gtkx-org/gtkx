import * as Gtk from "@gtkx/gi/gtk";
import { getWrapper, setWrapper } from "@gtkx/native";
import { getHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

describe("wrapper toggle references", () => {
    it("resolves a constructed wrapper back from its native handle by identity", () => {
        const label = new Gtk.Label();
        expect(getWrapper(getHandle(label))).toBe(label);
    });

    it("rebinds the wrapper for a GObject and resolves the new one by identity", () => {
        const label = new Gtk.Label();
        const handle = getHandle(label);
        const wrapper = { tag: "label-wrapper" };
        setWrapper(handle, wrapper);
        expect(getWrapper(handle)).toBe(wrapper);
    });
});

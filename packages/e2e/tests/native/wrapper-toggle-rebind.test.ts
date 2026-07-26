import * as Gtk from "@gtkx/gi/gtk";
import { getWrapper, setWrapper } from "@gtkx/native";
import { getHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { getRefCount } from "../helpers/native-utils.js";

describe("toggle-ref rebind", () => {
    it("reuses a single toggle ref and tracks the latest wrapper across rebinds", () => {
        const label = new Gtk.Label();
        const handle = getHandle(label);
        expect(getWrapper(handle)).toBe(label);

        for (let gen = 1; gen <= 5; gen++) {
            const next = { gen };
            setWrapper(handle, next);
            expect(getRefCount(handle)).toBe(1);
            expect(getWrapper(handle)).toBe(next);
        }
    });
});

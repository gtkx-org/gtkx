import { describe, expect, it } from "vitest";
import { getWrapper, type Handle, setWrapper } from "../../index.js";
import { createLabel } from "./utils.js";

describe("wrapper toggle references", () => {
    it("returns null for a GObject with no wrapper bound", () => {
        const label = createLabel("Unbound") as Handle;

        expect(getWrapper(label)).toBeNull();

        const wrapper = { tag: "release" };
        setWrapper(label, wrapper);
    });

    it("binds a wrapper to a GObject and resolves it back by identity", () => {
        const label = createLabel("Bound") as Handle;
        const wrapper = { tag: "label-wrapper" };

        setWrapper(label, wrapper);

        expect(getWrapper(label)).toBe(wrapper);
    });
});

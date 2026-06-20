import { describe, expect, it } from "vitest";
import { getWrapper, type Handle, setWrapper } from "../../index.js";
import { createLabel, getRefCount } from "./utils.js";

describe("toggle-ref rebind", () => {
    it("reuses a single toggle ref and tracks the latest wrapper across rebinds", () => {
        const label = createLabel("Rebind") as Handle;

        const first = { gen: 1 };
        setWrapper(label, first);
        expect(getRefCount(label)).toBe(1);
        expect(getWrapper(label)).toBe(first);

        for (let gen = 2; gen <= 5; gen++) {
            const next = { gen };
            setWrapper(label, next);
            expect(getRefCount(label)).toBe(1);
            expect(getWrapper(label)).toBe(next);
        }
    });
});

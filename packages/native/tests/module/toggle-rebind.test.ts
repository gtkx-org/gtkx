import { beforeAll, describe, expect, it } from "vitest";
import { applyWrapperRefOp, getWrapper, type NativeHandle, setObjectToggleNotify, setWrapper } from "../../index.js";
import { createLabel, getRefCount } from "./utils.js";

beforeAll(() => {
    setObjectToggleNotify((refPtr, op) => {
        applyWrapperRefOp(refPtr, op);
    });
});

describe("toggle-ref rebind", () => {
    it("reuses a single toggle ref and tracks the latest wrapper across rebinds", () => {
        const label = createLabel("Rebind") as NativeHandle;

        const first = { gen: 1 };
        setWrapper(label, first);
        expect(getRefCount(label)).toBe(1);
        expect(getWrapper(label)).toBe(first);

        // Re-binding the same object reuses its one toggle ref. A second
        // g_object_add_toggle_ref would raise "Unexpected number of toggle-refs"
        // and leave the count at 2; the qdata cell must instead adopt the newest
        // wrapper so identity follows the live binding.
        for (let gen = 2; gen <= 5; gen++) {
            const next = { gen };
            setWrapper(label, next);
            expect(getRefCount(label)).toBe(1);
            expect(getWrapper(label)).toBe(next);
        }
    });
});

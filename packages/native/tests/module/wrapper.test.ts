import { beforeAll, describe, expect, it } from "vitest";
import { applyWrapperRefOp, getWrapper, type NativeHandle, setObjectToggleNotify, setWrapper } from "../../index.js";
import { createLabel } from "./utils.js";

describe("wrapper toggle references", () => {
    beforeAll(() => {
        setObjectToggleNotify((refPtr, op) => {
            applyWrapperRefOp(refPtr, op);
        });
    });

    it("returns null for a GObject with no wrapper bound", () => {
        const label = createLabel("Unbound") as NativeHandle;

        expect(getWrapper(label)).toBeNull();

        const wrapper = { tag: "release" };
        setWrapper(label, wrapper);
    });

    it("binds a wrapper to a GObject and resolves it back by identity", () => {
        const label = createLabel("Bound") as NativeHandle;
        const wrapper = { tag: "label-wrapper" };

        setWrapper(label, wrapper);

        expect(getWrapper(label)).toBe(wrapper);
    });

    it("rejects a non-function toggle-notify callback", () => {
        const notAFunction: unknown = 42;

        expect(() => {
            setObjectToggleNotify(notAFunction as (refPtr: number, op: number) => void);
        }).toThrow();
    });
});

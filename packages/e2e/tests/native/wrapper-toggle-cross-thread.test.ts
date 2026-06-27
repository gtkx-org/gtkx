import { getHandle } from "@gtkx/ffi";
import * as Gtk from "@gtkx/gi/gtk";
import { getWrapper } from "@gtkx/native";
import { driveToggleFromThread, finalizeCount, watchObjectFinalize } from "@gtkx/native/test-support";
import { describe, expect, it } from "vitest";
import { forceGC, getRefCount } from "../helpers/native-utils.js";

describe("toggle references under cross-thread churn", () => {
    it("keeps wrapper identity and refcount stable while toggle notifies race GC", async () => {
        const label = new Gtk.Label();
        const handle = getHandle(label);
        watchObjectFinalize(handle);

        const baseRefCount = getRefCount(handle);
        const finalizedBefore = finalizeCount();

        driveToggleFromThread(handle, 200);

        forceGC();
        await new Promise((resolve) => setImmediate(resolve));

        expect(getRefCount(handle)).toBe(baseRefCount);
        expect(getWrapper(handle)).toBe(label);
        expect(finalizeCount()).toBe(finalizedBefore);
    });
});

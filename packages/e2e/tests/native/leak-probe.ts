import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

/** This isolated canary must fail in the shared afterEach hook before the real suite starts. */
test("the mandatory leak check rejects an unowned native allocation", () => {
    const duplicateWithoutOwnership = t.bind("libc.so.6", "strdup", [t.string()], t.string("borrowed"));
    expect(duplicateWithoutOwnership("gtkx-leak-check-canary")).toBe("gtkx-leak-check-canary");
});

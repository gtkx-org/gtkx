import { describe, expect, it } from "vitest";
import { callDescriptorFor, vtableSlotFor } from "../helpers/emitted-spec.js";
import { fixtureModules } from "../helpers/fixture-modules.js";

const skip = String(fixtureModules(["Skip-1.0"]).get("Skip"));

describe("a function whose GIR return value is skipped", () => {
    it("leaves the value out of the signature", () => {
        expect(skip).toContain("scan(): string {");
    });

    it("keeps the value in the call descriptor and marks it as unsurfaced", () => {
        expect(callDescriptorFor(skip, "skip_probe_scan")).toContain("returns: t.boolean, isReturnSkipped: true");
    });
});

describe("a vtable slot whose GIR return value is skipped", () => {
    it("leaves the value out of the vfunc signature", () => {
        expect(skip).toContain("protected vfuncScan(): string {");
    });

    it("keeps the value in the slot descriptor and marks it as unsurfaced", () => {
        const slot = vtableSlotFor(skip, "vfuncScan");
        expect(slot).toContain("returnDescriptor: t.boolean,");
        expect(slot).toContain("isReturnSkipped: true,");
    });
});

describe("a sibling callable GIR does not skip", () => {
    it("keeps the value in the signature of the function and of the slot", () => {
        expect(skip).toContain("rank(): [boolean, number] {");
        expect(skip).toContain("protected vfuncRank(): [boolean, number] {");
    });

    it("marks neither the call descriptor nor the slot descriptor", () => {
        expect(callDescriptorFor(skip, "skip_probe_rank")).not.toContain("isReturnSkipped");
        expect(vtableSlotFor(skip, "vfuncRank")).not.toContain("isReturnSkipped");
    });
});

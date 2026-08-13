import { describe, expect, it } from "vitest";
import { callDescriptorFor, memberSourceFor, switchCaseFor, vtableSlotFor } from "../helpers/emitted-spec.js";
import { fixtureModules } from "../helpers/fixture-modules.js";

type ReturnCase = { path: string; declaration: string; descriptor: string };

const skip = String(fixtureModules(["Skip-1.0"]).get("Skip"));
const connectSource = memberSourceFor(skip, "connect(signal: string,");
const emitSource = memberSourceFor(skip, "emit(sigName: string,");

const SKIPPED: ReturnCase[] = [
    {
        path: "a function",
        declaration: "scan(): string {",
        descriptor: callDescriptorFor(skip, "skip_probe_scan"),
    },
    {
        path: "a vtable slot",
        declaration: "protected vfuncScan(): string {",
        descriptor: vtableSlotFor(skip, "vfuncScan"),
    },
    {
        path: "a callback parameter",
        declaration: "export type NoticeFunc = () => string;",
        descriptor: callDescriptorFor(skip, "skip_probe_watch"),
    },
    {
        path: "a signal",
        declaration: "\"probed\": () => void;",
        descriptor: switchCaseFor(connectSource, "probed"),
    },
];

const SURFACED: ReturnCase[] = [
    {
        path: "a function",
        declaration: "rank(): [boolean, number] {",
        descriptor: callDescriptorFor(skip, "skip_probe_rank"),
    },
    {
        path: "a vtable slot",
        declaration: "protected vfuncRank(): [boolean, number] {",
        descriptor: vtableSlotFor(skip, "vfuncRank"),
    },
    {
        path: "a callback parameter",
        declaration: "export type WeightFunc = () => [boolean, number];",
        descriptor: callDescriptorFor(skip, "skip_probe_weigh"),
    },
    {
        path: "a signal",
        declaration: "\"ranked\": () => boolean | undefined;",
        descriptor: switchCaseFor(connectSource, "ranked"),
    },
];

describe("a GIR return value marked skip", () => {
    it.each(SKIPPED)("leaves the value out of the declaration of $path", ({ declaration }) => {
        expect(skip).toContain(declaration);
    });

    it.each(SKIPPED)("keeps the C type and marks the value unsurfaced on $path", ({ descriptor }) => {
        expect(descriptor).toContain("t.boolean");
        expect(descriptor).toContain("isReturnSkipped: true");
    });

    it("emits a signal against the C type and drops the value the emission returns", () => {
        expect(switchCaseFor(emitSource, "probed")).toContain(
            "emitSignal(this, sigName, [], { descriptor: t.boolean, isReturnSkipped: true })",
        );
    });
});

describe("a sibling GIR return value leaves unmarked", () => {
    it.each(SURFACED)("keeps the value in the declaration of $path", ({ declaration }) => {
        expect(skip).toContain(declaration);
    });

    it.each(SURFACED)("keeps the C type and marks nothing on $path", ({ descriptor }) => {
        expect(descriptor).toContain("t.boolean");
        expect(descriptor).not.toContain("isReturnSkipped");
    });

    it("emits a signal against the C type and surfaces the value the emission returns", () => {
        expect(switchCaseFor(emitSource, "ranked")).toContain(
            "emitSignal(this, sigName, [], { descriptor: t.boolean })",
        );
    });
});

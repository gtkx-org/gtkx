import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConformanceHarness, createGjsConformanceHarness } from "../helpers/gjs-conformance.js";

const HAPPY_RESULT = {
    arrays: {
        borrowed: [
            { number: 3, ratio: 0.125 },
            { number: 5, ratio: 0.25 },
        ],
        container: [
            { number: 3, ratio: 0.125 },
            { number: 5, ratio: 0.25 },
        ],
    },
    callerAllocated: {
        full: { number: 17, ratio: 1.25 },
        none: { number: 13, ratio: 0.75 },
    },
    checksum: 242,
    emptyOpaque: [],
    emptyOpaqueFlat: [],
    garrayInputs: { container: 105, full: 105, none: 105 },
    garrays: {
        borrowed: [
            { number: 3, ratio: 0.125 },
            { number: 5, ratio: 0.25 },
        ],
        container: [
            { number: 3, ratio: 0.125 },
            { number: 5, ratio: 0.25 },
        ],
        full: [
            { number: 3, ratio: 0.125 },
            { number: 5, ratio: 0.25 },
        ],
    },
    inlineArrays: { container: 105, full: 105, none: 105 },
    lifecyclePod: { number: 23, ratio: 1.25, text: null },
    nullRecords: { full: null, opaque: null },
    pod: { number: 42, ratio: 2 },
    recordInout: {
        original: { number: 41, ratio: 0.5 },
        replacement: { number: 42, ratio: 1 },
    },
    snapshot: { number: 7, ratio: 0.25 },
    sum: 42,
    textSnapshot: { number: 17, text: "café 日本語" },
    unionSnapshot: { number: 73 },
    validated: [true, 12],
};

const EDGE_RESULT = {
    arrays: {
        borrowed: [
            { number: -2_147_483_648, ratio: -1.5 },
            { number: 2_147_483_647, ratio: 0 },
        ],
        container: [
            { number: -2_147_483_648, ratio: -1.5 },
            { number: 2_147_483_647, ratio: 0 },
        ],
    },
    callerAllocated: {
        full: { number: 2_147_483_647, ratio: 0 },
        none: { number: -2_147_483_648, ratio: -1.5 },
    },
    emptyOpaque: [],
    emptyOpaqueFlat: [],
    garrayInputs: { container: -1, full: -1, none: -1 },
    garrays: {
        borrowed: [
            { number: -2_147_483_648, ratio: -1.5 },
            { number: 2_147_483_647, ratio: 0 },
        ],
        container: [
            { number: -2_147_483_648, ratio: -1.5 },
            { number: 2_147_483_647, ratio: 0 },
        ],
        full: [
            { number: -2_147_483_648, ratio: -1.5 },
            { number: 2_147_483_647, ratio: 0 },
        ],
    },
    inlineArrays: { container: -1, full: -1, none: -1 },
    lifecyclePod: { number: -2_147_483_648, ratio: -1.5, text: null },
    nullRecords: { full: null, opaque: null },
    pod: { number: -2_147_483_648, ratio: -1.5 },
    recordInout: {
        original: { number: -2_147_483_648, ratio: -1.5 },
        replacement: { number: -2_147_483_647, ratio: -1 },
    },
    snapshot: { number: -2_147_483_648, ratio: -1.5 },
    sum: 2_147_483_647,
    textSnapshot: { number: -2_147_483_648, text: "" },
    unionSnapshot: { number: -2_147_483_648 },
    validated: [true, 0],
};

const lifecycle = createHarnessLifecycle();

function createHarnessLifecycle(): {
    dispose: () => void;
    require: () => ConformanceHarness;
    start: () => Promise<void>;
} {
    let harness: ConformanceHarness | undefined;

    return {
        dispose: () => {
            harness?.dispose();
        },
        require: () => {
            if (harness === undefined) {
                throw new Error("The conformance harness is not ready");
            }

            return harness;
        },
        start: async () => {
            harness = await createGjsConformanceHarness();
        },
    };
}

beforeAll(async () => {
    await lifecycle.start();
}, 120_000);

afterAll(() => {
    lifecycle.dispose();
});

describe("GJS marshalling conformance", () => {
    it("matches scalar and plain-record behavior on the happy path", async () => {
        const active = lifecycle.require();
        const gjs = await active.runGjs("happy");
        const gtkx = await active.runGtkx("happy");
        expect(gjs).toEqual(HAPPY_RESULT);
        expect(gtkx).toEqual(gjs);
    });

    it("matches zero, negative, and integer-boundary behavior", async () => {
        const active = lifecycle.require();
        const gjs = await active.runGjs("edge");
        const gtkx = await active.runGtkx("edge");
        expect(gjs).toEqual(EDGE_RESULT);
        expect(gtkx).toEqual(gjs);
    });

    it(
        "throws for GError and unsupported plain-record marshalling",
        async () => {
            const active = lifecycle.require();
            await expect(active.runGtkx("outputCleanup")).rejects.toThrow();

            for (const scenario of [
                "fullPodContainer",
                "gerror",
                "inoutTransferFull",
                "invalidFlatPodArray",
                "invalidInlinePodArray",
                "lifecycleTransferFull",
                "opaqueContainer",
                "transferFull",
                "transferFullReturn",
                "unknownCallerAllocated",
            ] as const) {
                await expect(active.runGjs(scenario)).rejects.toThrow();
                await expect(active.runGtkx(scenario)).rejects.toThrow();
            }
        },
        30_000,
    );
});

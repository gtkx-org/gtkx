import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    fixtureConfig,
    generatedModule,
    VALUE_PARAMETER_BINDINGS,
    VALUE_PARAMETER_DECLARATIONS,
} from "./codegen-helpers.js";

type ExpectedOutput = { bindings: string[]; declarations: string[] };

const expectGenerated = (library: string, namespace: string, expected: ExpectedOutput): void => {
    using project = createCliProject({
        prefix: `gtkx-cli-codegen-${namespace}-`,
        config: fixtureConfig(library),
    });

    expect(runCli(project, ["codegen"]).status).toBe(0);
    const declarations = generatedModule(project, "gi", namespace, `${namespace}.d.ts`);
    const bindings = generatedModule(project, "gi", namespace, `${namespace}.js`);
    expect(expected.declarations.filter((text) => !declarations.includes(text))).toEqual([]);
    expect(expected.bindings.filter((text) => !bindings.includes(text))).toEqual([]);
};

describe("gtkx codegen marshalling", () => {
    it("represents byte sequences as typed arrays", () => {
        expectGenerated("ByteSeq-1.0", "byteseq", {
            declarations: [
                "readSized(): Uint8Array",
                "readByteArray(): Uint8Array",
                "writeSized(data: Uint8Array | number[]): void",
                "readNumbers(): number[]",
            ],
            bindings: ["isBytes: true", "t.byteArray("],
        });
    });

    it("accepts JavaScript values and unwraps returned GValues", () => {
        expectGenerated("ValueBox-1.0", "valuebox", {
            declarations: [
                ...VALUE_PARAMETER_DECLARATIONS,
                "peek(): unknown",
                "fill(): [boolean, unknown]",
            ],
            bindings: [...VALUE_PARAMETER_BINDINGS, "isReturnUnpacked: true", "isUnpacked: true"],
        });
    });

    it("trims the leading success value from finish results", () => {
        expectGenerated("AsyncPair-1.0", "asyncpair", {
            declarations: ["runAsync(): Promise<[string, number]>", "probeAsync(): Promise<boolean>"],
            bindings: ["promisify(asyncPairJobRunAsync, trimFinish(this.runFinish.bind(this))"],
        });
    });

    it("mutates caller-allocated inout records without returning them again", () => {
        expectGenerated("InoutBox-1.0", "inoutbox", {
            declarations: [
                "step(spot: Spot): boolean",
                "recenter(spot: Spot): void",
                "advance(offset: number): [boolean, number]",
                "locate(spot: Spot): [boolean, string]",
            ],
            bindings: [
                'direction: "inout", isCallerAllocated: true, isConsumed: true, isRequired: true }',
                't.int32, direction: "inout", isRequired: true }',
            ],
        });
    });
});

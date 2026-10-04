import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCliOrThrow } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import {
    compileNativeFixture,
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckFile,
} from "./type-consumer.js";

const FIXTURE = fileURLToPath(new URL("fixtures/field-layout.c", import.meta.url));
const CONFIG = fixtureConfig("FieldLayout-1.0");
const CONSUMER = `import assert from "node:assert/strict";
import { Sample } from "@gtkx/gi/fieldlayout";
import { quit } from "@gtkx/runtime";

try {
    const sample = Sample.new(false);
    const inlineValues: number[] = sample.inlineValues;
    const values: number[] = sample.values;
    assert.deepEqual(inlineValues, [1, 2, 3]);
    assert.deepEqual(values, [4, 5, 6]);
    assert.equal(sample.before, 11);
    assert.equal(sample.after, 19);
    sample.before = 61;
    sample.after = 73;
    sample.inlineValues = [7, 8, 9];
    assert.equal(sample.readBefore(), 61);
    assert.equal(sample.readAfter(), 73);
    assert.equal(sample.readInlineTotal(), 24);
    assert.deepEqual(sample.inlineValues, [7, 8, 9]);
    assert.deepEqual(sample.values, [4, 5, 6]);
    const blank = Sample.new(true);
    assert.deepEqual(blank.inlineValues, [0, 0, 0]);
    assert.deepEqual(blank.values, [0, 0, 0]);
    assert.equal(blank.readAfter(), 19);
    assert.throws(() => Reflect.set(sample, "after", "invalid"));
    assert.throws(() => Reflect.set(sample, "inlineValues", ["invalid"]));
    assert.equal(sample.readAfter(), 73);
    assert.equal(sample.readInlineTotal(), 24);
} finally {
    quit();
}
`;
const REJECTED: Record<string, string> = {
    "pointer-array-write.ts": `import type { Sample } from "@gtkx/gi/fieldlayout";
export const write = (sample: Sample): void => { sample.values = [1, 2, 3]; };
`,
    "pointer-array-constructor.ts": `import { Sample } from "@gtkx/gi/fieldlayout";
export const sample = new Sample({ values: [1, 2, 3] });
`,
    "inline-array-element.ts": `import type { Sample } from "@gtkx/gi/fieldlayout";
export const write = (sample: Sample): void => { sample.inlineValues = ["invalid"]; };
`,
    "scalar-field.ts": `import type { Sample } from "@gtkx/gi/fieldlayout";
export const write = (sample: Sample): void => { sample.after = "invalid"; };
`,
};

describe("generated fixed array field layout", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-field-layout-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, ...REJECTED },
        });
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("accepts scalar fields beside fixed inline and pointer-backed arrays", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects an incompatible consumer in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("round-trips inline arrays and following scalar fields through C", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-field-layout-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        compileNativeFixture(consumer, FIXTURE, "libfieldlayout.so.0", "gobject-2.0");
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

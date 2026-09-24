import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import {
    compileNativeFixture,
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckFile,
} from "./type-consumer.js";

const FIXTURE = fileURLToPath(new URL("fixtures/callback-fields.c", import.meta.url));
const GIR_PATH = fileURLToPath(new URL("fixtures/gir", import.meta.url));
const CONFIG = fixtureConfig("CallbackFields-1.0");
const CONSUMER = `import assert from "node:assert/strict";
import { Capsule, invoke, type Hook, type HookAliasChain } from "@gtkx/gi/callbackfields";
import { quit } from "@gtkx/runtime";

try {
    const capsule = new Capsule({ before: -7, after: 19 });
    assert.equal(capsule.before, -7);
    assert.equal(capsule.after, 19);
    assert.equal(capsule.readBefore(), -7);
    assert.equal(capsule.readAfter(), 19);
    capsule.before = 31;
    capsule.after = 47;
    assert.equal(capsule.readBefore(), 31);
    assert.equal(capsule.readAfter(), 47);
    const empty = new Capsule();
    assert.equal(empty.readBefore(), 0);
    assert.equal(empty.readAfter(), 0);
    for (const member of ["direct", "aliased", "inlineHooks", "hooks"]) {
        assert.equal(member in capsule, false);
    }
    assert.throws(() => Reflect.set(capsule, "before", "invalid"));
    assert.equal(capsule.readBefore(), 31);
    const values: number[] = [];
    const hook: Hook = (value) => { values.push(value); return value > 0; };
    const aliased: HookAliasChain = hook;
    assert.equal(invoke(aliased, 5), true);
    assert.equal(invoke(hook, -2), false);
    assert.equal(invoke(null, 8), false);
    assert.deepEqual(values, [5, -2]);
} finally {
    quit();
}
`;
const REJECTED: Record<string, string> = {
    "direct-read.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const read = (capsule: Capsule) => capsule.direct;
`,
    "direct-write.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const write = (capsule: Capsule, value: Capsule["direct"]): void => { capsule.direct = value; };
`,
    "direct-constructor.ts": `import { Capsule } from "@gtkx/gi/callbackfields";
export const capsule = new Capsule({ direct: null });
`,
    "aliased-read.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const read = (capsule: Capsule) => capsule.aliased;
`,
    "aliased-write.ts": `import type { Capsule, HookAliasChain } from "@gtkx/gi/callbackfields";
export const write = (capsule: Capsule, value: HookAliasChain): void => { capsule.aliased = value; };
`,
    "aliased-constructor.ts": `import { Capsule } from "@gtkx/gi/callbackfields";
export const capsule = new Capsule({ aliased: null });
`,
    "inline-callbacks.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const read = (capsule: Capsule) => capsule.inlineHooks;
`,
    "callback-array.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const read = (capsule: Capsule) => capsule.hooks;
`,
    "scalar-write.ts": `import type { Capsule } from "@gtkx/gi/callbackfields";
export const write = (capsule: Capsule): void => { capsule.after = "invalid"; };
`,
    "callback-result.ts": `import { invoke } from "@gtkx/gi/callbackfields";
export const result = invoke(() => "invalid", 5);
`,
};

describe("generated callback record fields", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-callback-field-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, ...REJECTED },
        });
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("accepts surrounding scalar fields and ordinary aliased callback inputs", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects an unsupported consumer in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents the same public fields", () => {
        const reference = loadApiReference({
            libraries: ["CallbackFields-1.0"],
            girPath: resolveGirPath([GIR_PATH], project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("CallbackFields.Capsule", "record");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `before`"));
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `after`"));
        for (const name of ["direct", "aliased", "inlineHooks", "hooks"]) {
            expect(page).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
    });

    it("reads the surrounding values through the native record", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-callback-field-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        expect(runCli(consumer, ["codegen"]).status).toBe(0);
        compileNativeFixture(consumer, FIXTURE, "libcallbackfields.so.0", "gobject-2.0");
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.hiddendata",' +
    " agents: { reference: false, rules: false } };";
const CONSUMER = `import assert from "node:assert/strict";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("getRegion" in GLib.Bytes.prototype, false);
    assert.equal("getData" in GLib.Variant.prototype, false);
    assert.equal("getData" in Gio.MemoryOutputStream.prototype, false);
    assert.equal("stealData" in Gio.MemoryOutputStream.prototype, false);
    const values = new Uint8Array([0, 255, 3]);
    const bytes = GLib.Bytes.new(values);
    const data: Uint8Array | null = bytes.getData();
    assert.deepEqual(data, values);
    assert.deepEqual(GLib.Bytes.newFromBytes(bytes, 1, 2).getData(), new Uint8Array([255, 3]));
    assert.deepEqual(GLib.Bytes.new([]).getData(), new Uint8Array());
    const variant = GLib.Variant.newBoolean(true);
    const serialized: GLib.Bytes = variant.getDataAsBytes();
    assert.deepEqual(serialized.getData(), new Uint8Array([1]));
    const stream = Gio.MemoryOutputStream.newResizable();
    assert.deepEqual(stream.writeAll(values, null), [true, values.length]);
    assert.equal(stream.close(null), true);
    const stolen: GLib.Bytes = stream.stealAsBytes();
    assert.deepEqual(stolen.getData(), values);
} finally {
    quit();
}
`;
const REJECTED: Record<string, string> = {
    "bytes-call.ts": `import type { Bytes } from "@gtkx/gi/glib";
export const region = (bytes: Bytes) => bytes.getRegion(1, 0, 1);
`,
    "bytes-member.ts": `import type { Bytes } from "@gtkx/gi/glib";
export type RegionMethod = Bytes["getRegion"];
`,
    "variant-call.ts": `import type { Variant } from "@gtkx/gi/glib";
export const data = (variant: Variant) => variant.getData();
`,
    "variant-member.ts": `import type { Variant } from "@gtkx/gi/glib";
export type DataMethod = Variant["getData"];
`,
    "stream-call.ts": `import type { MemoryOutputStream } from "@gtkx/gi/gio";
export const data = (stream: MemoryOutputStream) => stream.getData();
`,
    "stream-steal-call.ts": `import type { MemoryOutputStream } from "@gtkx/gi/gio";
export const data = (stream: MemoryOutputStream) => stream.stealData();
`,
    "stream-steal-member.ts": `import type { MemoryOutputStream } from "@gtkx/gi/gio";
export type StealMethod = MemoryOutputStream["stealData"];
`,
    "stream-member.ts": `import type { MemoryOutputStream } from "@gtkx/gi/gio";
export type DataMethod = MemoryOutputStream["getData"];
`,
};

describe("generated data-pointer method omissions", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-hidden-data-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, ...REJECTED },
        });
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("accepts the existing byte-owning methods", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted method in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents the existing methods without the omitted members", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        for (const { owner, omitted, retained } of [
            { owner: "GLib.Bytes", omitted: "getRegion", retained: "getData" },
            { owner: "GLib.Variant", omitted: "getData", retained: "getDataAsBytes" },
            { owner: "Gio.MemoryOutputStream", omitted: "getData", retained: "stealAsBytes" },
            { owner: "Gio.MemoryOutputStream", omitted: "stealData", retained: "stealAsBytes" },
        ]) {
            const page = reference.lookup(owner);
            expect(page.outcome).toBe("page");
            expect(page).toHaveProperty("markdown", expect.stringContaining(`### \`${retained}\``));
            expect(page).toHaveProperty("markdown", expect.not.stringContaining(`### \`${omitted}\``));
        }
    });

    it("imports the public bindings and uses their existing byte operations", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-hidden-data-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

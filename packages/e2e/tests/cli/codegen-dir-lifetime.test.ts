import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.dirlifetime", libraries: ["GLib-2.0"],' +
    " agents: { reference: false, rules: false } };";
const CONSUMER = `import assert from "node:assert/strict";
import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as GLib from "@gtkx/gi/glib";
import { quit } from "@gtkx/runtime";

export const emptyResult: ReturnType<GLib.Dir["readName"]> = null;

try {
    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-dir-consumer-"));
    const populated = join(temporary.path, "populated");
    const empty = join(temporary.path, "empty");
    mkdirSync(populated);
    mkdirSync(empty);
    writeFileSync(join(populated, "alpha.txt"), "alpha");
    writeFileSync(join(populated, "café.txt"), "café");
    assert.equal("close" in GLib.Dir.prototype, false);
    assert.equal("destroy" in GLib.Tree.prototype, false);

    const directory = GLib.Dir.open(populated, 0);
    const alias = directory;
    assert.equal("close" in directory, false);
    assert.deepEqual([directory.readName(), directory.readName()].toSorted(), ["alpha.txt", "café.txt"]);
    assert.equal(directory.readName(), null);
    alias.rewind();
    assert.deepEqual([alias.readName(), directory.readName()].toSorted(), ["alpha.txt", "café.txt"]);
    assert.equal(alias.readName(), null);

    const emptyDirectory = GLib.Dir.open(empty, 0);
    const exhausted: string | null = emptyDirectory.readName();
    assert.equal(exhausted, null);
    emptyDirectory.rewind();
    assert.equal(emptyDirectory.readName(), null);
    assert.throws(() => GLib.Dir.open(join(temporary.path, "missing"), 0));
} finally {
    quit();
}
`;
const TREE_READER = 'import * as GLib from "@gtkx/gi/glib";' +
    " export const read = (tree: GLib.Tree): [number, number] => [tree.height(), tree.nnodes()];";
const REJECTED: Record<string, string> = {
    "tree-destroy-call.ts": 'import * as GLib from "@gtkx/gi/glib";' +
        " export const destroy = (tree: GLib.Tree) => tree.destroy();",
    "tree-destroy-member.ts": 'import * as GLib from "@gtkx/gi/glib"; export type Destroy = GLib.Tree["destroy"];',
    "close-call.ts": 'import * as GLib from "@gtkx/gi/glib"; export const close = (dir: GLib.Dir) => dir.close();',
    "close-member.ts": 'import * as GLib from "@gtkx/gi/glib"; export type Close = GLib.Dir["close"];',
    "nonnull-result.ts": 'import * as GLib from "@gtkx/gi/glib";' +
        " export const read = (dir: GLib.Dir): string => dir.readName();",
};

describe("generated directory and tree lifetime contracts", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-dir-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, "tree-reader.ts": TREE_READER, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts directory readers with nullable results", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("accepts typed tree readers", () => {
        expect(typecheckFile(project, "tree-reader.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported contract in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents directory readers and non-consuming tree methods", () => {
        const reference = loadApiReference({
            libraries: ["GLib-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("GLib.Dir", "record");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `open`"));
        expect(page).toHaveProperty("markdown", expect.stringContaining("readName(): string | null"));
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `rewind`"));
        expect(page).toHaveProperty("markdown", expect.not.stringContaining("### `close`"));
        const tree = reference.lookup("GLib.Tree", "record");
        expect(tree.outcome).toBe("page");
        expect(tree).toHaveProperty("markdown", expect.stringContaining("height(): number"));
        expect(tree).toHaveProperty("markdown", expect.stringContaining("nnodes(): number"));
        expect(tree).toHaveProperty("markdown", expect.not.stringContaining("### `destroy`"));
    });

    it("reads and rewinds owned directories through public bindings", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-dir-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

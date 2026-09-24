import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.fileenumerator", libraries: ["Gio-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as Gio from "@gtkx/gi/gio";\n';
const CONSUMER = IMPORTS + `import assert from "node:assert/strict";
import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quit } from "@gtkx/runtime";

export const exhausted: ReturnType<Gio.FileEnumerator["iterate"]> = [true, null, null];

const enumerate = (path: string): Gio.FileEnumerator => Gio.File.newForPath(path).enumerateChildren(
    "standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null,
);

try {
    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-file-enumerator-"));
    const populated = join(temporary.path, "populated");
    const empty = join(temporary.path, "empty");
    mkdirSync(populated);
    mkdirSync(empty);
    writeFileSync(join(populated, "alpha.txt"), "alpha");
    writeFileSync(join(populated, "café.txt"), "café");

    const directory = enumerate(populated);
    try {
        const [firstOk, firstInfo, firstChild] = directory.iterate(null);
        assert.equal(firstOk, true);
        assert.ok(firstInfo !== null && firstChild !== null);
        const firstName = firstInfo.getName();
        assert.equal(firstChild.getPath(), join(populated, firstName));

        const [secondOk, secondInfo, secondChild] = directory.iterate(null);
        assert.equal(secondOk, true);
        assert.ok(secondInfo !== null && secondChild !== null);
        const secondName = secondInfo.getName();
        assert.equal(secondChild.getPath(), join(populated, secondName));
        assert.deepEqual([firstName, secondName].toSorted(), ["alpha.txt", "café.txt"]);
        assert.deepEqual(directory.iterate(null), exhausted);
        assert.equal(firstInfo.getName(), firstName);
        assert.equal(firstChild.getPath(), join(populated, firstName));
        assert.equal(secondInfo.getName(), secondName);
        assert.equal(secondChild.getPath(), join(populated, secondName));
    } finally {
        directory.close(null);
    }

    const emptyDirectory = enumerate(empty);
    try {
        assert.deepEqual(emptyDirectory.iterate(null), exhausted);
    } finally {
        emptyDirectory.close(null);
    }
    assert.throws(() => emptyDirectory.iterate(null));
    assert.throws(() => enumerate(join(temporary.path, "missing")));
} finally {
    quit();
}
`;
const CONTROL = IMPORTS + `export const read = (enumerator: Gio.FileEnumerator): boolean =>
    enumerator.iterate(null)[0];
`;
const REJECTED = {
    "nonnull-info.ts": IMPORTS + "export const read = (enumerator: Gio.FileEnumerator): Gio.FileInfo => " +
        "enumerator.iterate(null)[1];",
    "nonnull-child.ts": IMPORTS + "export const read = (enumerator: Gio.FileEnumerator): Gio.File => " +
        "enumerator.iterate(null)[2];",
};

describe("generated file enumerator nullable results", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-file-enumerator-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, "control.ts": CONTROL, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts nullable iteration results and narrowed readers", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("preserves the non-null success result", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects non-null assumptions in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents nullable end-of-directory outputs", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("Gio.FileEnumerator", "class");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "iterate(cancellable: NativeInstance<Gio.Cancellable> | null): " +
            "[boolean, Gio.FileInfo | null, Gio.File | null]",
        ));
    });

    it("iterates owned directories and preserves borrowed results", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-file-enumerator-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

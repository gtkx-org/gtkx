import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.ostreevfunc", libraries: ["OSTree-1.0"],' +
    " agents: { reference: false, rules: false } };";
const CONSUMER = `import assert from "node:assert/strict";
import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gio from "@gtkx/gi/gio";
import * as OSTree from "@gtkx/gi/ostree";
import { keepAlive } from "@gtkx/native";
import { callParent, callVfunc, quit, registerClass } from "@gtkx/runtime";

class ParentFinder extends OSTree.RepoFinderConfig {
    finishThroughSuper(result: Gio.AsyncResult): OSTree.RepoFinderResult[] {
        return super.vfuncResolveFinish(result);
    }
}
registerClass(ParentFinder, { typeName: "GtkxOstreeParentFinder" });

class EmptyFinder extends OSTree.RepoFinderConfig {
    finishes = 0;

    override vfuncResolveFinish(result: Gio.AsyncResult): OSTree.RepoFinderResult[] {
        assert.ok(result instanceof Gio.Task);
        this.finishes += 1;
        return [];
    }
}
registerClass(EmptyFinder, { typeName: "GtkxOstreeEmptyFinder" });

using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-ostree-vfunc-"));
keepAlive(true);
try {
    const repo = OSTree.Repo.new(Gio.File.newForPath(temporary.path));
    assert.equal(repo.create(OSTree.RepoMode.ARCHIVE, null), true);
    const ref = OSTree.CollectionRef.new("org.gtkx.VfuncFixture", "app/test/stable");
    const finder = OSTree.RepoFinderConfig.new();
    const parentFinder = new ParentFinder({});
    const nextResult = (source: OSTree.RepoFinderConfig): Promise<Gio.AsyncResult> =>
        new Promise((resolve) => {
            source.vfuncResolveAsync([ref], repo, null, (_source, result) => resolve(result));
        });
    const routes = [
        {
            source: finder,
            invoke: (result: Gio.AsyncResult) => finder.vfuncResolveFinish(result),
        },
        {
            source: parentFinder,
            invoke: (result: Gio.AsyncResult) => parentFinder.finishThroughSuper(result),
        },
        {
            source: finder,
            invoke: (result: Gio.AsyncResult) =>
                callVfunc(OSTree.RepoFinder, "vfuncResolveFinish", finder, [result]),
        },
        {
            source: parentFinder,
            invoke: (result: Gio.AsyncResult) =>
                callParent(ParentFinder, "vfuncResolveFinish", parentFinder, result),
        },
    ];
    for (const { source, invoke } of routes) {
        const result = await nextResult(source);
        assert.ok(result instanceof Gio.Task);
        assert.throws(() => invoke(result));
        assert.deepEqual(await source.resolveAsync([ref], repo, null), []);
    }

    const implemented = new EmptyFinder({});
    assert.deepEqual(await implemented.resolveAsync([ref], repo, null), []);
    assert.equal(implemented.finishes, 1);
    assert.deepEqual(await OSTree.RepoFinder.resolveAllAsync([implemented], [ref], repo, null), []);
    assert.equal(implemented.finishes, 2);
    const result = await nextResult(implemented);
    assert.deepEqual(implemented.vfuncResolveFinish(result), []);
    assert.equal(implemented.finishes, 3);
} finally {
    keepAlive(false);
    quit();
}
`;

const EXPECTED_SIGNATURE = "vfuncResolveFinish(result: Gio.AsyncResult): OSTree.RepoFinderResult[]";

describe("generated OSTree native vfunc call admission", () => {
    it("rejects native finish calls while preserving public resolution and JS overrides", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-ostree-vfunc-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(project, ["codegen"]);
        expect(() => {
            runNativeConsumer(project);
        }).not.toThrow();
        isolateTypeConsumer(project);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("documents the retained override signature and restricted native call routes", () => {
        const reference = loadApiReference({
            libraries: ["OSTree-1.0"],
            girPath: resolveGirPath([]),
            resolveFrom: process.cwd(),
        });
        const page = reference.lookup("OSTree.RepoFinder", "interface");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(EXPECTED_SIGNATURE));
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "Calling the native implementation through this member, `super`, `callVfunc` or `callParent` throws.",
        ));
        expect(page).toHaveProperty("markdown", expect.stringContaining("Overriding it remains supported."));
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `vfuncResolveAsync`"));
        expect(page).toHaveProperty("markdown", expect.stringContaining("### `resolveAsync`"));
    });
});

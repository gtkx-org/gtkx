import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.ostreefinder", libraries: ["OSTree-1.0"],' +
    " agents: { reference: false, rules: false } };";
const OPTIONS_TYPE = "a{sv}";
const CONSUMER = `import assert from "node:assert/strict";
import { mkdirSync, mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gio from "@gtkx/gi/gio";
import * as OSTree from "@gtkx/gi/ostree";
import { keepAlive } from "@gtkx/native";
import { quit, toVariant } from "@gtkx/runtime";

using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-ostree-finder-values-"));
const parentPath = join(temporary.path, "parent");
const remotePath = join(temporary.path, "remote");
const emptyPath = join(temporary.path, "empty");
for (const path of [parentPath, remotePath, emptyPath]) {
    mkdirSync(path);
}

keepAlive(true);
try {
    const parent = OSTree.Repo.new(Gio.File.newForPath(parentPath));
    assert.equal(parent.create(OSTree.RepoMode.ARCHIVE, null), true);
    const finder = OSTree.RepoFinderConfig.new();
    const collectionId = "org.gtkx.FinderFixture";
    const ref = OSTree.CollectionRef.new(collectionId, "app/test/stable");
    const resolvers = [
        (cancellable: Gio.Cancellable | null) => finder.resolveAsync([ref], parent, cancellable),
        (cancellable: Gio.Cancellable | null) =>
            OSTree.RepoFinder.resolveAllAsync([finder], [ref], parent, cancellable),
    ];
    for (const resolve of resolvers) {
        assert.deepEqual(await resolve(null), []);
    }

    const remoteFile = Gio.File.newForPath(remotePath);
    const remote = OSTree.Repo.new(remoteFile);
    assert.equal(remote.setCollectionId(collectionId), true);
    assert.equal(remote.create(OSTree.RepoMode.ARCHIVE, null), true);
    const tree = OSTree.MutableTree.new();
    assert.equal(remote.writeDirectoryToMtree(Gio.File.newForPath(emptyPath), tree, null, null), true);
    const [wroteTree, rootFile] = remote.writeMtree(tree, null);
    assert.equal(wroteTree, true);
    assert.ok(rootFile instanceof OSTree.RepoFile);
    const [wroteCommit, checksum] = remote.writeCommit(null, "Fixture", null, null, rootFile, null);
    assert.equal(wroteCommit, true);
    assert.equal(remote.setCollectionRefImmediate(ref, checksum, null), true);
    assert.equal(remote.regenerateSummary(null, null), true);
    const options = toVariant("${OPTIONS_TYPE}", { "collection-id": toVariant("s", collectionId) });
    const remoteUri = remoteFile.getUri();
    assert.equal(parent.remoteAdd("local", remoteUri, options, null), true);

    for (const resolve of resolvers) {
        const results: OSTree.RepoFinderResult[] = await resolve(null);
        assert.equal(results.length, 1);
        const [result] = results;
        assert.ok(result instanceof OSTree.RepoFinderResult);
        assert.equal(result.remote.getName(), "local");
        assert.equal(result.remote.getUrl(), remoteUri);
        assert.equal(result.priority, 100);
        assert.equal(result.summaryLastModified, 0n);
        assert.equal(result.finder, finder);
        const cancelled = new Gio.Cancellable();
        cancelled.cancel();
        await assert.rejects(resolve(cancelled));
        const recovered = await resolve(null);
        assert.equal(recovered.length, 1);
        assert.equal(result.remote.getName(), "local");
        assert.equal(result.priority, 100);
        assert.equal(result.compare(result.dup()), 0);
    }
} finally {
    keepAlive(false);
    quit();
}
`;

describe("generated OSTree finder result ownership", () => {
    it("retains result values across empty, completed and cancelled operations", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-ostree-finder-",
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
});

import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const FIXTURE = fileURLToPath(new URL("fixtures/async-pair.c", import.meta.url));
const CONSUMER = `import assert from "node:assert/strict";
import { Client, Job, Pool, queryAsync, Sack } from "@gtkx/gi/asyncpair";
import * as Gio from "@gtkx/gi/gio";
import { keepAlive } from "@gtkx/native";
import { quit } from "@gtkx/runtime";

const completeThroughOwner = (start: (callback: Gio.AsyncReadyCallback) => void): Promise<void> =>
    new Promise((resolve, reject) => {
        const returned = start((source, result) => {
            try {
                assert.ok(source instanceof Client);
                assert.equal(Gio.Task.isValid(result, source), true);
                assert.equal(source.genericFinish(result), true);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
        assert.equal(returned, undefined);
    });

keepAlive(true);
try {
    const job = new Job();
    const run = job.runAsync();
    assert.ok(run instanceof Promise);
    assert.deepEqual(await run, ["done", 3]);
    assert.equal(await job.probeAsync(), true);
    assert.equal(await queryAsync(true), 42);
    await assert.rejects(queryAsync(false));
    const created = await Job.createAsync(true);
    assert.ok(created instanceof Job);
    assert.equal(await created.probeAsync(), true);
    await assert.rejects(Job.createAsync(false));

    const sack = new Sack();
    assert.equal(await sack.fetchAsync(), true);
    assert.equal(await sack.refreshAsync(null), true);
    const cancellable = new Gio.Cancellable();
    assert.equal(await sack.fetchAsync(cancellable), true);
    assert.equal(await sack.refreshAsync(cancellable), true);
    cancellable.cancel();
    await assert.rejects(sack.fetchAsync(cancellable));
    await assert.rejects(sack.refreshAsync(cancellable));

    await completeThroughOwner((callback) => job.externalAsync(callback));
    const pool = new Pool();
    await completeThroughOwner((callback) => pool.drainAsync(null, callback));
} finally {
    keepAlive(false);
    quit();
}
`;

const compileFixture = (project: CliProject): void => {
    const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", "gio-2.0"], {
        encoding: "utf8",
    }).trim().split(/\s+/);
    execFileSync(resolveExecutable("cc"), [
        "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror", FIXTURE,
        "-o", join(project.root, "libasyncpair.so.0"), ...flags,
    ]);
};

const runConsumer = (project: CliProject): void => {
    const libraryPath = [project.root, process.env.LD_LIBRARY_PATH]
        .filter((entry) => entry !== undefined && entry !== "")
        .join(":");
    execFileSync(process.execPath, ["--conditions=source", "--import=tsx", "probe.ts"], {
        cwd: project.root,
        env: { ...process.env, LD_LIBRARY_PATH: libraryPath },
        stdio: "pipe",
        timeout: 30_000,
    });
};

describe("generated async consumers", () => {
    it("resolves paired finishes and leaves external owners to callbacks", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-async-consumer-",
            config: fixtureConfig("AsyncPair-1.0"),
            files: { "probe.ts": CONSUMER },
        });
        expect(runCli(project, ["codegen"]).status).toBe(0);
        compileFixture(project);
        expect(() => {
            runConsumer(project);
        }).not.toThrow();
        isolateTypeConsumer(project);
        expect(typecheckSource(project, CONSUMER)).toBe(0);
    });
});

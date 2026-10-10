import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runner = join(workspace, "scripts/ci/run.mjs");
const require = createRequire(import.meta.url);
const localEnvironment = { ...process.env, GTKX_CI_CONTAINER: "" };
const run = (command, args = [], options = {}) =>
    spawnSync(process.execPath, [runner, command, ...args], {
        cwd: workspace,
        env: localEnvironment,
        encoding: "utf8",
        timeout: 10_000,
        ...options,
    });

test("local task commands preserve quoted arguments and exit status", () => {
    const args = ["two words", "an'apostrophe", "$HOME", "; exit 9", "", "line\nbreak"];
    const result = run("node -e 'console.log(JSON.stringify(process.argv.slice(1)))'", args);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), args);
    assert.equal(run("exit 7").status, 7);
});

test("container tasks wait for process groups and preserve output, status, arguments and environment", (t) => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-container-boundary-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const docker = join(directory, "docker");

    writeFileSync(
        docker,
        `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
if (args.shift() !== "exec") process.exit(99);
const env = { PATH: process.env.GTKX_TEST_CONTAINER_PATH, HOME: process.env.HOME };
let cwd;
while (args[0]?.startsWith("--")) {
    const option = args.shift();
    const value = args.shift();
    if (option === "--workdir") cwd = value;
    else if (option === "--env") env[value] = process.env[value];
    else process.exit(98);
}
if (args.shift() !== "gtkx-boundary-test") process.exit(97);
const result = spawnSync(args.shift(), args, { cwd, env, stdio: "inherit", detached: true });
if (result.error) throw result.error;
if (result.signal) process.kill(process.pid, result.signal);
process.exit(result.status ?? 1);
`,
    );
    chmodSync(docker, 0o755);

    const args = ["two words", "an'apostrophe", "$HOME", "; exit 9"];
    const result = run(
        "node -e 'setTimeout(() => { console.log(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),path:process.env.PATH," +
            "ci:process.env.CI,nodeOptions:process.env.NODE_OPTIONS,container:process.env.GTKX_CI_CONTAINER," +
            "runtimeHash:process.env.GTKX_CI_RUNTIME_HASH,nativeHash:process.env.GTKX_CI_NATIVE_HASH," +
            "secret:process.env.GTKX_TEST_SECRET})); process.exit(17); }, 50)'",
        args,
        {
            cwd: join(workspace, "packages/css"),
            env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                GTKX_TEST_CONTAINER_PATH: process.env.PATH,
                GTKX_CI_CONTAINER: "gtkx-boundary-test",
                GTKX_CI_RUNTIME_HASH: "runtime-fingerprint",
                GTKX_CI_NATIVE_HASH: "native-fingerprint",
                GTKX_TEST_SECRET: "outside-only",
                CI: "true",
                NODE_OPTIONS: "--max-old-space-size=2048",
            },
        },
    );

    assert.equal(result.status, 17, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.args, args);
    assert.equal(output.cwd, join(workspace, "packages/css"));
    assert.equal(output.ci, "true");
    assert.equal(output.nodeOptions, "--max-old-space-size=2048");
    assert.equal(output.container, undefined);
    assert.equal(output.runtimeHash, undefined);
    assert.equal(output.nativeHash, undefined);
    assert.equal(output.secret, undefined);
    assert.ok(
        output.path.startsWith(
            [join(workspace, "packages/css/node_modules/.bin"), join(workspace, "node_modules/.bin")].join(":"),
        ),
    );
});

test("cancelling a local task stops its child process and preserves the signal", { timeout: 10_000 }, async (t) => {
    const child = spawn(
        process.execPath,
        [runner, "node -e 'process.stdout.write(String(process.pid) + \"\\n\"); setInterval(()=>{},1000)'"],
        {
            cwd: workspace,
            env: localEnvironment,
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    const lines = createInterface({ input: child.stdout });
    let taskPid;
    t.after(async () => {
        lines.close();
        if (child.exitCode === null && child.signalCode === null) {
            const stopped = once(child, "exit", { signal: AbortSignal.timeout(2_000) });
            child.kill("SIGTERM");
            try {
                await stopped;
            } catch (error) {
                child.kill("SIGKILL");
                if (error.name !== "AbortError") throw error;
            }
        }
        if (Number.isSafeInteger(taskPid) && taskPid > 0) {
            try {
                process.kill(taskPid, "SIGKILL");
            } catch (error) {
                if (error.code !== "ESRCH") throw error;
            }
        }
    });

    const [line] = await once(lines, "line", { signal: AbortSignal.timeout(5_000) });
    const reportedPid = Number(line);
    assert.ok(Number.isSafeInteger(reportedPid) && reportedPid > 0);
    taskPid = reportedPid;
    const exited = once(child, "exit", { signal: AbortSignal.timeout(5_000) });
    child.kill("SIGTERM");
    const [code, signal] = await exited;
    assert.equal(code, null);
    assert.equal(signal, "SIGTERM");

    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            process.kill(taskPid, 0);
        } catch (error) {
            if (error.code !== "ESRCH") throw error;
            taskPid = undefined;
            return;
        }
        await setTimeout(10);
    }

    assert.fail("The cancelled task left its child process running");
});

test(
    "Nx resolves wrapped inferred tasks with their original build options and wrapper cache inputs",
    {
        timeout: 60_000,
    },
    (t) => {
        const directory = mkdtempSync(join(tmpdir(), "gtkx-inference-contract-"));
        t.after(() => rmSync(directory, { recursive: true, force: true }));
        const result = spawnSync(
            process.execPath,
            [require.resolve("nx/bin/nx.js"), "show", "project", "@gtkx/css", "--json"],
            {
                cwd: workspace,
                env: {
                    ...localEnvironment,
                    NX_DAEMON: "false",
                    NX_NO_CLOUD: "true",
                    NX_CLOUD_ACCESS_TOKEN: "",
                    NX_CACHE_PROJECT_GRAPH: "false",
                    NX_WORKSPACE_DATA_DIRECTORY: join(directory, "workspace-data"),
                },
                encoding: "utf8",
                timeout: 55_000,
                maxBuffer: 8 * 1024 * 1024,
            },
        );

        assert.equal(result.status, 0, result.stderr);
        const project = JSON.parse(result.stdout);

        for (const name of ["build", "typecheck", "test", "lint"]) {
            const target = project.targets[name];
            assert.equal(target.executor, "nx:run-commands");
            assert.match(target.options.command, /node "\$NX_WORKSPACE_ROOT\/scripts\/ci\/run\.mjs"/);
            assert.ok(target.inputs.includes("{workspaceRoot}/scripts/ci/**/*"));
            assert.equal(target.cache, true);
        }

        assert.deepEqual(project.targets.build.options.args, ["--noCheck"]);
        assert.ok(project.targets.build.dependsOn.includes("gtkx:_build:bindings"));
    },
);

test("native release builds restore only checksum-verified staged artifacts", (t) => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-native-release-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const artifacts = join(directory, "artifacts");
    mkdirSync(artifacts);
    const platform = `linux-${process.arch}-gnu`;
    const files = new Map([
        [`native.${platform}.node`, "staged native binary"],
        [`index.${platform}.js`, "export const staged = true;"],
        [`index.${platform}.d.ts`, "export declare const staged: true;"],
    ]);
    for (const [name, contents] of files) {
        writeFileSync(join(artifacts, name), contents);
        const checksum = createHash("sha256").update(contents).digest("hex");
        writeFileSync(join(artifacts, `${name}.sha256`), `${checksum}  ${name}\n`);
    }
    const build = (...args) =>
        spawnSync(
            process.execPath,
            ["--import", require.resolve("tsx/esm"), join(workspace, "packages/native/tools/build.ts"), ...args],
            {
                cwd: directory,
                env: localEnvironment,
                encoding: "utf8",
                timeout: 10_000,
            },
        );
    const restored = build("--from-artifacts");
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(
        readFileSync(join(directory, `native.${platform}.node`), "utf8"),
        files.get(`native.${platform}.node`),
    );
    assert.equal(readFileSync(join(directory, "index.js"), "utf8"), files.get(`index.${platform}.js`));
    assert.equal(readFileSync(join(directory, "index.d.ts"), "utf8"), files.get(`index.${platform}.d.ts`));
    writeFileSync(join(artifacts, `index.${platform}.js`), "corrupt artifact");
    const corrupted = build("--from-artifacts");
    assert.notEqual(corrupted.status, 0);
    assert.match(corrupted.stderr, /checksum mismatch/);
    assert.equal(readFileSync(join(directory, "index.js"), "utf8"), files.get(`index.${platform}.js`));
    const withBuildFlags = build("--from-artifacts", "--debug");
    assert.notEqual(withBuildFlags.status, 0);
    assert.match(withBuildFlags.stderr, /cannot accept build arguments/);
});

test("CI checks are acyclic and release configurations reach native builds", { timeout: 60_000 }, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-release-graph-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const result = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "-e",
            `import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createProjectGraphAsync } = require("nx/src/project-graph/project-graph");
const { createTaskGraph } = require("nx/src/tasks-runner/create-task-graph");
const { findCycle } = require("nx/src/tasks-runner/task-graph-utils");
const graph = await createProjectGraphAsync();
const checks = createTaskGraph(graph, {}, Object.keys(graph.nodes), ["build", "test", "typecheck", "lint", "e2e"], undefined, {});
const projects = Object.keys(graph.nodes).filter(name => graph.nodes[name].data.targets?.release);
const release = createTaskGraph(graph, {}, projects, ["release"], "release-artifacts", {});
const local = createTaskGraph(graph, {}, projects, ["release"], undefined, {});
console.log(JSON.stringify({ checksCycle: findCycle(checks), release, local, native: graph.nodes["@gtkx/native"].data.targets }));`,
        ],
        {
            cwd: workspace,
            env: {
                ...localEnvironment,
                NX_DAEMON: "false",
                NX_NO_CLOUD: "true",
                NX_CLOUD_ACCESS_TOKEN: "",
                NX_CACHE_PROJECT_GRAPH: "false",
                NX_WORKSPACE_DATA_DIRECTORY: join(directory, "workspace-data"),
            },
            encoding: "utf8",
            timeout: 55_000,
            maxBuffer: 8 * 1024 * 1024,
        },
    );
    assert.equal(result.status, 0, result.stderr);
    const { checksCycle, release, local, native } = JSON.parse(result.stdout);
    assert.equal(checksCycle, null, checksCycle?.join(" -> "));
    const nativeBuilds = Object.values(release.tasks).filter(
        (task) => task.target.project === "@gtkx/native" && task.target.target === "build",
    );
    assert.equal(nativeBuilds.length, 1);
    assert.equal(nativeBuilds[0].target.configuration, "release-artifacts");
    assert.ok(
        release.dependencies["@gtkx/native:release:release-artifacts"].includes("@gtkx/native:build:release-artifacts"),
    );
    assert.ok(release.dependencies["gtkx:_build:bindings"].includes("@gtkx/native:build:release-artifacts"));
    assert.equal(local.tasks["@gtkx/native:build"].target.configuration, undefined);
    assert.match(native.build.configurations["release-artifacts"].command, /build --from-artifacts/);
    assert.match(native.release.configurations["release-artifacts"].command, /prepublish\.ts --from-artifacts/);
});

test("release publishing and verification use explicitly supplied registry deadlines", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-release-registry-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    let visible = true;
    const requests = [];
    const registry = createServer((request, response) => {
        requests.push(request.url);
        response.setHeader("Content-Type", "application/json");
        response.end(
            JSON.stringify(
                request.url.endsWith("/1.0.0")
                    ? { version: "1.0.0" }
                    : { "dist-tags": visible ? { latest: "1.0.0" } : {} },
            ),
        );
    });
    registry.listen(0, "127.0.0.1");
    await once(registry, "listening");
    t.after(() => registry.close());
    const address = registry.address();
    assert.ok(address && typeof address === "object");
    writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({
            name: "@gtkx/release-fixture",
            version: "1.0.0",
            publishConfig: { registry: `http://127.0.0.1:${address.port}` },
        }),
    );
    const { publishPackage } = await tsImport("../pnpm-publish.ts", import.meta.url);
    const { verifyReleaseChannel } = await tsImport("../release-channel.ts", import.meta.url);
    await publishPackage(directory, "latest", 1_000);
    await verifyReleaseChannel([directory], 1_000);
    assert.ok(requests.some((path) => path.endsWith("/1.0.0")));
    assert.ok(requests.some((path) => !path.endsWith("/1.0.0")));
    visible = false;
    await assert.rejects(publishPackage(directory, "latest", 50), /within 50 ms/);
    await assert.rejects(verifyReleaseChannel([directory], 50), /within 50 ms/);
});

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runner = join(workspace, "scripts/ci/run.mjs");
const require = createRequire(import.meta.url);
const localEnvironment = { ...process.env, GTKX_CI_CONTAINER: "" };
const run = (command, args = [], options = {}) => spawnSync(process.execPath, [runner, command, ...args], {
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

    writeFileSync(docker, `#!/usr/bin/env node
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
`);
    chmodSync(docker, 0o755);

    const args = ["two words", "an'apostrophe", "$HOME", "; exit 9"];
    const result = run(
        "node -e 'setTimeout(() => { console.log(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),path:process.env.PATH,"
            + "ci:process.env.CI,workers:process.env.GTKX_MAX_WORKERS,container:process.env.GTKX_CI_CONTAINER,"
            + "secret:process.env.GTKX_TEST_SECRET})); process.exit(17); }, 50)'",
        args,
        {
            cwd: join(workspace, "packages/css"),
            env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                GTKX_TEST_CONTAINER_PATH: process.env.PATH,
                GTKX_CI_CONTAINER: "gtkx-boundary-test",
                GTKX_TEST_SECRET: "outside-only",
                CI: "true",
                GTKX_MAX_WORKERS: "2",
            },
        },
    );

    assert.equal(result.status, 17, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.args, args);
    assert.equal(output.cwd, join(workspace, "packages/css"));
    assert.equal(output.ci, "true");
    assert.equal(output.workers, "2");
    assert.equal(output.container, undefined);
    assert.equal(output.secret, undefined);
    assert.ok(output.path.startsWith([
        join(workspace, "packages/css/node_modules/.bin"),
        join(workspace, "node_modules/.bin"),
    ].join(":")));
});

test("cancelling a local task stops its child process and preserves the signal", { timeout: 10_000 }, async (t) => {
    const child = spawn(process.execPath, [runner,
        'node -e \'process.stdout.write(String(process.pid) + "\\n"); setInterval(()=>{},1000)\'',
    ], {
        cwd: workspace,
        env: localEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
    });
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

test("Nx resolves wrapped inferred tasks with their original build options and wrapper cache inputs", {
    timeout: 60_000,
}, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-inference-contract-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const result = spawnSync(process.execPath, [require.resolve("nx/bin/nx.js"), "show", "project", "@gtkx/css", "--json"], {
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
    });

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
});

import { resolveExecutable } from "@gtkx/utils";
import {
    existsSync,
    mkdirSync,
    mkdtempDisposableSync,
    readdirSync,
    readFileSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVitest, resolveConfig } from "vitest/node";
import { resolveHeadlessOptions, startHeadlessDisplay } from "../src/headless.js";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const pluginPath = join(workspace, "packages/vitest/dist/index.js");

const writePathWithoutSway = (directory: string): string => {
    const bin = join(directory, "bin");
    mkdirSync(bin);
    symlinkSync(resolveExecutable("dbus-daemon"), join(bin, "dbus-daemon"));

    return bin;
};

const writeDelayedCompositor = (directory: string): void => {
    const sway = resolveExecutable("sway");
    writeFileSync(
        join(directory, "sway"),
        `#!/usr/bin/env python3
import os
import socket
import sys
import time

path = os.path.join(os.environ["XDG_RUNTIME_DIR"], "wayland-1")
with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
    listener.bind(path)
    time.sleep(0.5)
os.unlink(path)
os.execv(${JSON.stringify(sway)}, ["sway", *sys.argv[1:]])
`,
        { mode: 0o755 },
    );
};

const probe = (name: string) => `import { test, expect } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
test("isolated ${name}", async () => {
    const root = process.env.XDG_RUNTIME_DIR;
    expect(existsSync(join(root, process.env.WAYLAND_DISPLAY))).toBe(true);
    expect(process.env.DBUS_SESSION_BUS_ADDRESS).toContain(root);
    const workerSource = 'import { parentPort } from "node:worker_threads"; parentPort.postMessage(process.env.XDG_RUNTIME_DIR);';
    const worker = new Worker(new URL("data:text/javascript," + encodeURIComponent(workerSource)));
    const inherited = await new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
    expect(inherited).toBe(root);
    await worker.terminate();
    writeFileSync(new URL("./${name}.json", import.meta.url), JSON.stringify({ root }));
});`;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("headless Vitest integration", () => {
    it("runs independent workers and tears down their displays after the run", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-test-"));
        mkdirSync(join(directory.path, "node_modules"));
        symlinkSync(join(workspace, "node_modules/vitest"), join(directory.path, "node_modules/vitest"), "dir");
        writeFileSync(join(directory.path, "package.json"), '{"type":"module"}');
        writeFileSync(
            join(directory.path, "gtkx.config.ts"),
            'export default { applicationId: "org.gtkx.vitest", codegen: false };',
        );
        writeFileSync(
            join(directory.path, "vitest.config.mjs"),
            `import gtkx from ${JSON.stringify(pluginPath)};
            export default { plugins: [gtkx({ size: "640x480" })], test: { include: ["*.test.mjs"] } };`,
        );
        for (const name of ["first", "second"]) writeFileSync(join(directory.path, `${name}.test.mjs`), probe(name));
        const runner = await createVitest({
            root: directory.path,
            config: join(directory.path, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        const roots: string[] = [];
        try {
            const results = await runner.start();
            expect(results.testModules).toHaveLength(2);
            expect(results.unhandledErrors).toEqual([]);
            expect(results.testModules.map((module) => module.state())).toEqual(["passed", "passed"]);
            for (const name of ["first", "second"]) {
                const report = JSON.parse(readFileSync(join(directory.path, `${name}.json`), "utf8")) as {
                    root: string;
                };
                roots.push(report.root);
            }
            expect(new Set(roots).size).toBe(2);
        } finally {
            await runner.close();
        }
        for (const root of roots) await expect.poll(() => existsSync(root)).toBe(false);
    });

    it("lets workers cancelled by bail exit through their exit handlers", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-bail-"));
        mkdirSync(join(directory.path, "node_modules"));
        symlinkSync(join(workspace, "node_modules/vitest"), join(directory.path, "node_modules/vitest"), "dir");
        writeFileSync(join(directory.path, "package.json"), '{"type":"module"}');
        writeFileSync(
            join(directory.path, "gtkx.config.ts"),
            'export default { applicationId: "org.gtkx.vitest", codegen: false };',
        );
        writeFileSync(
            join(directory.path, "vitest.config.mjs"),
            `import gtkx from ${JSON.stringify(pluginPath)};
            export default { plugins: [gtkx()], test: { include: ["*.test.mjs"], bail: 1 } };`,
        );
        const names = ["first", "second"];
        for (const name of names) {
            writeFileSync(
                join(directory.path, `${name}.test.mjs`),
                `import { test } from "vitest";
                import { writeFileSync } from "node:fs";
                writeFileSync(new URL("./${name}.started", import.meta.url), "");
                process.on("exit", () => writeFileSync(new URL("./${name}.exited", import.meta.url), ""));
                test("fails", () => { throw new Error("expected failure"); });`,
            );
        }
        const runner = await createVitest({
            root: directory.path,
            config: join(directory.path, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        try {
            await runner.start();
        } finally {
            await runner.close();
        }
        const started = names.filter((name) => existsSync(join(directory.path, `${name}.started`)));
        expect(started).not.toEqual([]);
        for (const name of started)
            await expect.poll(() => existsSync(join(directory.path, `${name}.exited`))).toBe(true);
    });

    it("resolves its configuration without sway but fails to create the runner", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-missing-"));
        const config = join(directory.path, "vitest.config.mjs");
        writeFileSync(config, `import gtkx from ${JSON.stringify(pluginPath)}; export default { plugins: [gtkx()] };`);
        vi.stubEnv("PATH", writePathWithoutSway(directory.path));
        await expect(resolveConfig({ root: directory.path, config })).resolves.toBeDefined();
        await expect(createVitest({ root: directory.path, config, watch: false, reporters: [] })).rejects.toThrow();
    });

    it("rejects when sway is missing, leaving no runtime directory or environment changes", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-missing-"));
        const runtimeRoot = join(directory.path, "tmp");
        mkdirSync(runtimeRoot);
        const before = {
            runtime: process.env.XDG_RUNTIME_DIR,
            display: process.env.WAYLAND_DISPLAY,
            bus: process.env.DBUS_SESSION_BUS_ADDRESS,
        };
        vi.stubEnv("PATH", writePathWithoutSway(directory.path));
        vi.stubEnv("TMPDIR", runtimeRoot);
        await expect(startHeadlessDisplay(resolveHeadlessOptions({}))).rejects.toThrow();
        expect(readdirSync(runtimeRoot)).toEqual([]);
        expect({
            runtime: process.env.XDG_RUNTIME_DIR,
            display: process.env.WAYLAND_DISPLAY,
            bus: process.env.DBUS_SESSION_BUS_ADDRESS,
        }).toEqual(before);
    });

    it.each(["normal", "delayed"])(
        "starts and tears down an owned display with %s compositor startup while restoring its caller's environment",
        async (startup) => {
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-compositor-"));
            const originalPath = process.env.PATH;
            try {
                if (startup === "delayed") {
                    writeDelayedCompositor(directory.path);
                    process.env.PATH = `${directory.path}:${originalPath ?? ""}`;
                }
                const before = {
                    runtime: process.env.XDG_RUNTIME_DIR,
                    display: process.env.WAYLAND_DISPLAY,
                    bus: process.env.DBUS_SESSION_BUS_ADDRESS,
                };
                const stop = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
                const runtime = process.env.XDG_RUNTIME_DIR;
                try {
                    expect(runtime).toBeDefined();
                    if (runtime === undefined) throw new Error("Missing display runtime directory");
                    expect(existsSync(join(runtime, process.env.WAYLAND_DISPLAY ?? ""))).toBe(true);
                } finally {
                    stop();
                    stop();
                }
                expect(process.env.XDG_RUNTIME_DIR).toBe(before.runtime);
                expect(process.env.WAYLAND_DISPLAY).toBe(before.display);
                expect(process.env.DBUS_SESSION_BUS_ADDRESS).toBe(before.bus);
                await expect.poll(() => runtime === undefined || existsSync(runtime), { timeout: 5_000 }).toBe(false);
            } finally {
                if (originalPath === undefined) {
                    delete process.env.PATH;
                } else {
                    process.env.PATH = originalPath;
                }
            }
        },
    );
});

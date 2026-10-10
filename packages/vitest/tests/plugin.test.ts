import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createVitest } from "vitest/node";
import { resolveHeadlessOptions, startHeadlessDisplay } from "../src/headless.js";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const probe = (name: string) => `import { test, expect } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
test("isolated ${name}", async () => {
    const root = process.env.XDG_RUNTIME_DIR;
    expect(existsSync(join(root, process.env.WAYLAND_DISPLAY))).toBe(true);
    expect(process.env.DBUS_SESSION_BUS_ADDRESS).toContain(root);
    const worker = new Worker('require("node:worker_threads").parentPort.postMessage(process.env.XDG_RUNTIME_DIR)', { eval: true });
    const inherited = await new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
    expect(inherited).toBe(root);
    await worker.terminate();
    writeFileSync(new URL("./${name}.json", import.meta.url), JSON.stringify({ root }));
});`;

describe("headless Vitest integration", () => {
    it("runs independent workers and tears down their displays after the run", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-vitest-test-"));
        mkdirSync(join(directory.path, "node_modules"));
        symlinkSync(join(workspace, "node_modules/vitest"), join(directory.path, "node_modules/vitest"), "dir");
        const pluginPath = join(workspace, "packages/vitest/dist/index.js");
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

    it("starts and tears down an owned display while restoring its caller's environment", async () => {
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
        expect(runtime === undefined || existsSync(runtime)).toBe(false);
    });
});

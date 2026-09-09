import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempDisposableSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_PACKAGE = join(WORKSPACE_ROOT, "packages", "cli");
const CLI_BIN = join(CLI_PACKAGE, "bin", "gtkx.js");
const DEV_RUNNER_BIN = join(CLI_PACKAGE, "bin", "gtkx-dev-runner.js");
const CACHE_HOME_PREFIX = "gtkx-compile-cache-";
const READ_ONLY_MODE = 0o500;

const countEntries = (dir: string): number => {
    try {
        return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
    } catch {
        return 0;
    }
};

const cachedEntries = (cacheHome: string): number => countEntries(join(cacheHome, "gtkx", "compile-cache"));

const runBin = (bin: string, args: string[], overrides: NodeJS.ProcessEnv): SpawnSyncReturns<string> =>
    spawnSync(process.execPath, [bin, ...args], {
        cwd: CLI_PACKAGE,
        encoding: "utf8",
        env: { ...process.env, ...overrides },
    });

describe("the compile cache", () => {
    it("caches compiled toolchain modules for the CLI", () => {
        using cacheHome = mkdtempDisposableSync(join(tmpdir(), CACHE_HOME_PREFIX));

        expect(runBin(CLI_BIN, ["--version"], { XDG_CACHE_HOME: cacheHome.path }).status).toBe(0);
        expect(cachedEntries(cacheHome.path)).toBeGreaterThan(0);
    });

    it("caches compiled toolchain modules for the development runner", () => {
        using cacheHome = mkdtempDisposableSync(join(tmpdir(), CACHE_HOME_PREFIX));

        runBin(DEV_RUNNER_BIN, [], { XDG_CACHE_HOME: cacheHome.path });

        expect(cachedEntries(cacheHome.path)).toBeGreaterThan(0);
    });

    it("caches nothing when the compile cache is disabled", () => {
        using cacheHome = mkdtempDisposableSync(join(tmpdir(), CACHE_HOME_PREFIX));

        const run = runBin(CLI_BIN, ["--version"], {
            GTKX_DISABLE_COMPILE_CACHE: "1",
            XDG_CACHE_HOME: cacheHome.path,
        });

        expect(run.status).toBe(0);
        expect(cachedEntries(cacheHome.path)).toBe(0);
    });

    it("caches into the directory the user chose instead of its own", () => {
        using cacheHome = mkdtempDisposableSync(join(tmpdir(), CACHE_HOME_PREFIX));
        const chosen = join(cacheHome.path, "chosen");

        const run = runBin(CLI_BIN, ["--version"], {
            NODE_COMPILE_CACHE: chosen,
            XDG_CACHE_HOME: cacheHome.path,
        });

        expect(run.status).toBe(0);
        expect(countEntries(chosen)).toBeGreaterThan(0);
        expect(cachedEntries(cacheHome.path)).toBe(0);
    });

    it("still runs when the cache directory cannot be created", () => {
        using parent = mkdtempDisposableSync(join(tmpdir(), CACHE_HOME_PREFIX));
        const cacheHome = join(parent.path, "read-only");
        mkdirSync(cacheHome);
        chmodSync(cacheHome, READ_ONLY_MODE);

        expect(runBin(CLI_BIN, ["--version"], { XDG_CACHE_HOME: cacheHome }).status).toBe(0);
        expect(countEntries(cacheHome)).toBe(0);
    });
});

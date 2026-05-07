import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeInputHash, writeCacheManifest } from "../../src/codegen/codegen-cache.js";
import { preflightCodegen, runCodegen } from "../../src/codegen/run-codegen.js";

const installFfiPackage = (cwd: string) => {
    const ffiDir = join(cwd, "node_modules", "@gtkx", "ffi");
    mkdirSync(ffiDir, { recursive: true });
    writeFileSync(
        join(ffiDir, "package.json"),
        JSON.stringify({ name: "@gtkx/ffi", version: "0.0.0", main: "./index.js" }),
    );
    writeFileSync(join(ffiDir, "index.js"), "");
    mkdirSync(join(ffiDir, "dist", "generated"), { recursive: true });
    return ffiDir;
};

const writeConfig = (cwd: string, body = `export default { libraries: ["Gtk-4.0"] };`) => {
    writeFileSync(join(cwd, "gtkx.config.ts"), `${body}\n`);
};

const readCodegenVersion = (): string => {
    const req = createRequire(import.meta.url);
    const pkgPath = req.resolve("@gtkx/codegen/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
};

describe("runCodegen", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-run-codegen-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("returns ran=false when the cache is valid and the FFI output dir exists", async () => {
        installFfiPackage(cwd);
        writeConfig(cwd);

        const version = readCodegenVersion();
        const inputHash = computeInputHash({ libraries: ["Gtk-4.0"] }, version);
        writeCacheManifest(cwd, inputHash, version);

        const result = await runCodegen({ cwd });

        expect(result.ran).toBe(false);
        expect(result.namespaces).toBe(0);
        expect(result.widgets).toBe(0);
        expect(result.duration).toBe(0);
    });

    it("throws when no gtkx.config.ts is present", async () => {
        installFfiPackage(cwd);
        await expect(runCodegen({ cwd })).rejects.toThrow();
    });

    it("falls back to process.cwd() when options.cwd is omitted", async () => {
        await expect(runCodegen()).rejects.toThrow();
    });
});

describe("preflightCodegen", () => {
    let cwd: string;
    const originalEnv = process.env.GTKX_DISABLE_PREFLIGHT;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-preflight-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
        if (originalEnv === undefined) {
            delete process.env.GTKX_DISABLE_PREFLIGHT;
        } else {
            process.env.GTKX_DISABLE_PREFLIGHT = originalEnv;
        }
    });

    it("returns silently when GTKX_DISABLE_PREFLIGHT=1", async () => {
        process.env.GTKX_DISABLE_PREFLIGHT = "1";
        await expect(preflightCodegen(cwd)).resolves.toBeUndefined();
    });

    it("returns silently when there is no gtkx.config.ts", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installFfiPackage(cwd);
        await expect(preflightCodegen(cwd)).resolves.toBeUndefined();
    });

    it("propagates non-NotFound config errors", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installFfiPackage(cwd);
        writeConfig(cwd, `export default { libraries: [] };`);

        await expect(preflightCodegen(cwd)).rejects.toThrow();
    });

    it("returns silently when the FFI is workspace-linked (real cwd outside node_modules)", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        await expect(preflightCodegen(cwd)).resolves.toBeUndefined();
    });
});

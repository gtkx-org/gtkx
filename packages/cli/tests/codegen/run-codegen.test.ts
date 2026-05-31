import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureGenerated, preflightCodegen, runCodegen } from "../../src/codegen/run-codegen.js";

vi.mock("@gtkx/codegen", () => ({
    CodegenRunner: class {
        run() {
            return Promise.resolve({ namespaces: 1, widgets: 0, duration: 1 });
        }
    },
}));

const installPackage = (cwd: string, name: string) => {
    const dir = join(cwd, "node_modules", "@gtkx", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: `@gtkx/${name}`, version: "0.0.0", main: "./index.js" }),
    );
    writeFileSync(join(dir, "index.js"), "");
    const generatedDir = join(dir, "dist", "generated");
    mkdirSync(generatedDir, { recursive: true });
    return generatedDir;
};

const installFfiPackage = (cwd: string) => installPackage(cwd, "ffi");

const writeConfig = (cwd: string, body = `export default { libraries: ["Gtk-4.0"], girPath: ["${cwd}"] };`) => {
    writeFileSync(join(cwd, "gtkx.config.ts"), `${body}\n`);
};

const writeNamespaceModule = (generatedDir: string, namespace: string) => {
    mkdirSync(join(generatedDir, namespace), { recursive: true });
    writeFileSync(join(generatedDir, namespace, `${namespace}.js`), "");
};

const writeReactModules = (generatedDir: string) => {
    for (const module of ["compounds.js", "internal.js", "jsx.js"]) {
        writeFileSync(join(generatedDir, module), "");
    }
};

const preflightLogs = async (cwd: string): Promise<string> => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
        await preflightCodegen(cwd);
        return logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    } finally {
        logSpy.mockRestore();
    }
};

describe("runCodegen", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-run-codegen-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("throws when no gtkx.config.ts is present", async () => {
        installFfiPackage(cwd);
        await expect(runCodegen({ cwd })).rejects.toThrow();
    });

    it("falls back to process.cwd() when options.cwd is omitted", async () => {
        const originalCwd = process.cwd();
        process.chdir(cwd);
        try {
            await expect(runCodegen()).rejects.toThrow();
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("with clean, removes the FFI and React output dirs before regenerating", async () => {
        const ffiGenerated = installFfiPackage(cwd);
        const reactGenerated = installPackage(cwd, "react");
        writeConfig(cwd);
        const ffiStale = join(ffiGenerated, "stale.js");
        const reactStale = join(reactGenerated, "stale.js");
        writeFileSync(ffiStale, "");
        writeFileSync(reactStale, "");

        const result = await runCodegen({ cwd, clean: true });

        expect(existsSync(ffiStale)).toBe(false);
        expect(existsSync(reactStale)).toBe(false);
        expect(result.namespaces).toBe(1);
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

    it("runs codegen when a configured namespace module is missing", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installFfiPackage(cwd);
        writeConfig(cwd);

        expect(await preflightLogs(cwd)).toContain("running codegen");
    });

    it("skips codegen when every configured namespace module exists", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        writeNamespaceModule(installFfiPackage(cwd), "gtk");
        writeReactModules(installPackage(cwd, "react"));
        writeConfig(cwd);

        expect(await preflightLogs(cwd)).toBe("");
    });
});

describe("ensureGenerated", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-ensure-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("regenerates when a React generated module is missing", async () => {
        writeNamespaceModule(installFfiPackage(cwd), "gtk");
        installPackage(cwd, "react");
        writeConfig(cwd);

        expect(await ensureGenerated(cwd)).toBe(true);
    });

    it("does nothing when every FFI and React module exists", async () => {
        writeNamespaceModule(installFfiPackage(cwd), "gtk");
        writeReactModules(installPackage(cwd, "react"));
        writeConfig(cwd);

        expect(await ensureGenerated(cwd)).toBe(false);
    });

    it("does nothing when there is no gtkx.config.ts", async () => {
        installFfiPackage(cwd);

        expect(await ensureGenerated(cwd)).toBe(false);
    });

    it("propagates non-NotFound config errors", async () => {
        installFfiPackage(cwd);
        writeConfig(cwd, `export default { libraries: [] };`);

        await expect(ensureGenerated(cwd)).rejects.toThrow();
    });
});

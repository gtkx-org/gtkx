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
    computeFingerprint: () => "test-fingerprint",
    FINGERPRINT_FILENAME: ".codegen-fingerprint.json",
}));

/** Writes a fingerprint sentinel whose recomputed value matches the mock. */
const writeFingerprint = (
    cwd: string,
    libraries: readonly string[] = ["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"],
) => {
    writeFileSync(
        join(cwd, "node_modules", ".gtkx", "gi", ".codegen-fingerprint.json"),
        JSON.stringify({ value: "test-fingerprint", girFiles: [], libraries }),
    );
};

const installPackage = (cwd: string, name: string) => {
    const dir = join(cwd, "node_modules", "@gtkx", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: `@gtkx/${name}`, version: "0.0.0", main: "./index.js" }),
    );
    writeFileSync(join(dir, "index.js"), "");
};

const installFfiPackage = (cwd: string) => installPackage(cwd, "ffi");

/**
 * Installs `@gtkx/react` plus the bare `react` runtime so the jsx codegen path
 * is active — `isCodegenNeeded` only considers the jsx unit when both resolve.
 */
const installReactStack = (cwd: string) => {
    installPackage(cwd, "react");
    const dir = join(cwd, "node_modules", "react");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "react", version: "19.0.0", main: "./index.js" }));
    writeFileSync(join(dir, "index.js"), "");
};

const writeConfig = (cwd: string, body = `export default { libraries: ["Gtk-4.0"], girPath: ["${cwd}"] };`) => {
    writeFileSync(join(cwd, "gtkx.config.ts"), `${body}\n`);
};

/** Materializes the gi store barrel for `namespace`, its visible alias, and the bundled store links. */
const writeGiBarrel = (cwd: string, namespace: string) => {
    mkdirSync(join(cwd, "node_modules", ".gtkx", "gi", namespace), { recursive: true });
    writeFileSync(join(cwd, "node_modules", ".gtkx", "gi", namespace, "index.js"), "");
    mkdirSync(join(cwd, "node_modules", "@gtkx", "gi"), { recursive: true });
    for (const pkg of ["ffi", "gi"]) {
        const linkDir = join(cwd, "node_modules", ".gtkx", "gi", "node_modules", "@gtkx", pkg);
        mkdirSync(linkDir, { recursive: true });
        writeFileSync(join(linkDir, "package.json"), JSON.stringify({ name: `@gtkx/${pkg}`, version: "0.0.0" }));
    }
};

/** Materializes gi barrels for every namespace the default library set resolves to. */
const writeDefaultGiBarrels = (cwd: string) => {
    for (const namespace of ["gtk", "adw", "gtksource", "webkit"]) {
        writeGiBarrel(cwd, namespace);
    }
};

/** Materializes the jsx unit modules plus its visible alias. */
const writeJsxStore = (cwd: string) => {
    const dir = join(cwd, "node_modules", ".gtkx", "jsx");
    mkdirSync(dir, { recursive: true });
    for (const module of ["compounds.js", "internal.js", "jsx.js", "presence.js"]) {
        writeFileSync(join(dir, module), "");
    }
    mkdirSync(join(cwd, "node_modules", "@gtkx", "react-jsx"), { recursive: true });
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

    it("with force, removes the gi store before regenerating", async () => {
        installFfiPackage(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        const giStale = join(cwd, "node_modules", ".gtkx", "gi", "stale.js");
        writeFileSync(giStale, "");

        const result = await runCodegen({ cwd, force: true });

        expect(existsSync(giStale)).toBe(false);
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

    it("runs codegen when the gi store is missing", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installFfiPackage(cwd);
        writeConfig(cwd);

        expect(await preflightLogs(cwd)).toContain("running codegen");
    });

    it("skips codegen when the gi and jsx stores are present", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installFfiPackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);

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

    it("regenerates when the jsx unit is missing", async () => {
        installFfiPackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);

        expect(await ensureGenerated(cwd)).toBe(true);
    });

    it("does nothing when the gi and jsx stores are present", async () => {
        installFfiPackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);

        expect(await ensureGenerated(cwd)).toBe(false);
    });

    it("does not wedge on a missing jsx unit when the react runtime is absent", async () => {
        installFfiPackage(cwd);
        installPackage(cwd, "react");
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeFingerprint(cwd);

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

describe("ensureGenerated — store links", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-ensure-links-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("regenerates when the bundled gi store links are pruned", async () => {
        installFfiPackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeJsxStore(cwd);
        rmSync(join(cwd, "node_modules", ".gtkx", "gi", "node_modules", "@gtkx", "ffi"), {
            recursive: true,
            force: true,
        });

        expect(await ensureGenerated(cwd)).toBe(true);
    });
});

describe("ensureGenerated — fingerprint", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-ensure-fp-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    const installPresentStore = () => {
        installFfiPackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeJsxStore(cwd);
    };

    it("regenerates when the fingerprint sentinel is absent", async () => {
        installPresentStore();

        expect(await ensureGenerated(cwd)).toBe(true);
    });

    it("regenerates when the fingerprint value no longer matches", async () => {
        installPresentStore();
        writeFileSync(
            join(cwd, "node_modules", ".gtkx", "gi", ".codegen-fingerprint.json"),
            JSON.stringify({
                value: "stale",
                girFiles: [],
                libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"],
            }),
        );

        expect(await ensureGenerated(cwd)).toBe(true);
    });

    it("regenerates when the resolved library set changed", async () => {
        installPresentStore();
        writeFingerprint(cwd, ["Gtk-4.0", "Adw-1"]);

        expect(await ensureGenerated(cwd)).toBe(true);
    });

    it("skips when the fingerprint matches", async () => {
        installPresentStore();
        writeFingerprint(cwd);

        expect(await ensureGenerated(cwd)).toBe(false);
    });
});

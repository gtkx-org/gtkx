import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { didRegenerate, runCodegen, syncSchemaEnv } from "../../src/codegen/run-codegen.js";

const writeFingerprint = (cwd: string, libraries: string[] = ["Gtk-4.0"]) => {
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

const installRuntimePackage = (cwd: string) => {
    installPackage(cwd, "runtime");
    installPackage(cwd, "native");
};

const installReactStack = (cwd: string) => {
    installPackage(cwd, "react");
    const dir = join(cwd, "node_modules", "react");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "react", version: "19.0.0", main: "./index.js" }));
    writeFileSync(join(dir, "index.js"), "");
};

const writeConfig = (
    cwd: string,
    body = `export default { applicationId: "org.gtk.Test", libraries: ["Gtk-4.0"], girPath: ["${cwd}"] };`,
) => {
    writeFileSync(join(cwd, "gtkx.config.ts"), `${body}\n`);
};

const writeStoreManifest = (cwd: string, name: "gi" | "jsx") => {
    const storeDir = join(cwd, "node_modules", ".gtkx", name);
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(join(storeDir, "package.json"), JSON.stringify({ name: `@gtkx/${name}`, version: "0.0.0" }));
    mkdirSync(join(cwd, "node_modules", "@gtkx", name), { recursive: true });
};

const writeGiBarrel = (cwd: string, namespace: string) => {
    mkdirSync(join(cwd, "node_modules", ".gtkx", "gi", namespace), { recursive: true });
    writeFileSync(join(cwd, "node_modules", ".gtkx", "gi", namespace, "index.js"), "");
    writeStoreManifest(cwd, "gi");
};

const writeDefaultGiBarrels = (cwd: string) => {
    for (const namespace of ["gtk", "adw", "gtksource", "webkit"]) {
        writeGiBarrel(cwd, namespace);
    }
};

const writeJsxStore = (cwd: string) => {
    const dir = join(cwd, "node_modules", ".gtkx", "jsx");
    mkdirSync(join(dir, "gtk"), { recursive: true });
    writeFileSync(join(dir, "metadata.js"), "");
    writeFileSync(join(dir, "gtk", "gtk.js"), "");
    writeStoreManifest(cwd, "jsx");
};

const installReactProject = (cwd: string) => {
    installRuntimePackage(cwd);
    installReactStack(cwd);
    writeConfig(cwd);
    writeDefaultGiBarrels(cwd);
};

const announceLogs = async (cwd: string): Promise<string> => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
        await didRegenerate(cwd, { shouldAnnounce: true });

        return stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    } finally {
        stderrSpy.mockRestore();
    }
};

vi.mock("@gtkx/codegen", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/codegen")>()),
    runCodegen: (options: { isForced?: boolean }) =>
        Promise.resolve({ isRegenerated: options.isForced === true, namespaces: 1, intrinsicElements: 0, duration: 1 }),
}));

describe("runCodegen", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-run-codegen-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("rejects when no gtkx.config.ts is present because applicationId is required", async () => {
        installRuntimePackage(cwd);
        await expect(runCodegen({ cwd })).rejects.toThrow(/invalid `applicationId`/);
    });

    it("falls back to process.cwd() when options.cwd is omitted", async () => {
        installRuntimePackage(cwd);
        writeConfig(cwd);
        const originalCwd = process.cwd();
        process.chdir(cwd);

        try {
            const result = await runCodegen();
            expect(result.configFile).toBeDefined();
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("with force, removes the gi store before regenerating", async () => {
        installRuntimePackage(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        const giStale = join(cwd, "node_modules", ".gtkx", "gi", "stale.js");
        writeFileSync(giStale, "");
        const result = await runCodegen({ cwd, isForced: true });
        expect(existsSync(giStale)).toBe(false);
        expect(result.namespaces).toBe(1);
    });
});

describe("didRegenerate — announce path", () => {
    let cwd: string;
    const originalEnv = process.env.GTKX_DISABLE_PREFLIGHT;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-announce-"));
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
        expect(await didRegenerate(cwd, { shouldAnnounce: true })).toBe(false);
    });

    it("rejects when there is no gtkx.config.ts", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installRuntimePackage(cwd);
        await expect(didRegenerate(cwd, { shouldAnnounce: true })).rejects.toThrow(/invalid `applicationId`/);
    });

    it("propagates non-NotFound config errors", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installRuntimePackage(cwd);
        writeConfig(cwd, "export default { libraries: [] };");
        await expect(didRegenerate(cwd, { shouldAnnounce: true })).rejects.toThrow();
    });

    it("runs codegen when the gi store is missing", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installRuntimePackage(cwd);
        writeConfig(cwd);
        expect(await announceLogs(cwd)).toContain("running codegen");
    });

    it("skips codegen when the gi and jsx stores are present", async () => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
        installRuntimePackage(cwd);
        installReactStack(cwd);
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);
        expect(await announceLogs(cwd)).toBe("");
    });
});

describe("didRegenerate", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-ensure-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("regenerates when the jsx unit is missing", async () => {
        installReactProject(cwd);
        expect(await didRegenerate(cwd)).toBe(true);
    });

    it("does nothing when the gi and jsx stores are present", async () => {
        installReactProject(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);
        expect(await didRegenerate(cwd)).toBe(false);
    });

    it("does not wedge on a missing jsx unit when the react runtime is absent", async () => {
        installRuntimePackage(cwd);
        installPackage(cwd, "react");
        writeConfig(cwd);
        writeDefaultGiBarrels(cwd);
        writeFingerprint(cwd);
        expect(await didRegenerate(cwd)).toBe(false);
    });

    it("rejects when there is no gtkx.config.ts", async () => {
        installRuntimePackage(cwd);
        await expect(didRegenerate(cwd)).rejects.toThrow(/invalid `applicationId`/);
    });

    it("propagates non-NotFound config errors", async () => {
        installRuntimePackage(cwd);
        writeConfig(cwd, "export default { libraries: [] };");
        await expect(didRegenerate(cwd)).rejects.toThrow();
    });
});

describe("didRegenerate — store links", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-ensure-links-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("regenerates when the gi store link is pruned", async () => {
        installReactProject(cwd);
        writeJsxStore(cwd);
        rmSync(join(cwd, "node_modules", "@gtkx", "gi"), { recursive: true, force: true });
        expect(await didRegenerate(cwd)).toBe(true);
    });

    it("regenerates when the jsx store link is pruned", async () => {
        installReactProject(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);
        rmSync(join(cwd, "node_modules", "@gtkx", "jsx"), { recursive: true, force: true });
        expect(await didRegenerate(cwd)).toBe(true);
    });

    it("regenerates when a store manifest is pruned but its modules remain", async () => {
        installReactProject(cwd);
        writeJsxStore(cwd);
        writeFingerprint(cwd);
        rmSync(join(cwd, "node_modules", ".gtkx", "jsx", "package.json"), { force: true });
        expect(await didRegenerate(cwd)).toBe(true);
    });
});

describe("syncSchemaEnv", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-sync-schema-env-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("writes the declaration file for a project that declares no data directory", () => {
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "app", version: "0.0.0" }));
        syncSchemaEnv(cwd);
        expect(existsSync(join(cwd, "node_modules", ".gtkx", "env.d.ts"))).toBe(true);
    });
});

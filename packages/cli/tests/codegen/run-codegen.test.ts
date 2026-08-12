import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodegenContext } from "../../src/codegen/store-resolver.js";
import { ensureGenerated, ensureGeneratedIn, runCodegen, syncSchemaEnv } from "../../src/codegen/run-codegen.js";
import { collectLogged } from "../stderr-text.js";
import { setupTempTree } from "../temp-tree.js";

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

const writeDisabledConfig = (cwd: string) => {
    writeConfig(cwd, 'export default { applicationId: "org.gtk.Test", libraries: ["Gtk-4.0"], codegen: false };');
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

const installGeneratedProject = (cwd: string) => {
    installReactProject(cwd);
    writeJsxStore(cwd);
    writeFingerprint(cwd);
};

const announceLogs = async (cwd: string): Promise<string> => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
        await ensureGenerated(cwd, { shouldAnnounce: true });

        return collectLogged(stderrSpy);
    } finally {
        stderrSpy.mockRestore();
    }
};

const restorePreflightEnv = (): void => {
    const originalEnv = process.env.GTKX_DISABLE_PREFLIGHT;

    beforeEach(() => {
        delete process.env.GTKX_DISABLE_PREFLIGHT;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.GTKX_DISABLE_PREFLIGHT;
        } else {
            process.env.GTKX_DISABLE_PREFLIGHT = originalEnv;
        }
    });
};

const missingConfigMessage = (cwd: string): string => `gtkx.config.ts: no configuration file found in ${cwd}`;

const expectMissingConfig = async (cwd: string): Promise<void> => {
    await expect(ensureGenerated(cwd, { shouldAnnounce: true })).rejects.toThrow(missingConfigMessage(cwd));
};

const contextFor = (root: string): CodegenContext => ({
    root,
    configFile: "gtkx.config.ts",
    config: { applicationId: "org.gtk.Test", libraries: ["Gtk-4.0"], girPath: [root] },
});

vi.mock("@gtkx/codegen", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/codegen")>()),
    runCodegen: (options: { isForced?: boolean }) =>
        Promise.resolve({ isRegenerated: options.isForced === true, namespaces: 1, intrinsicElements: 0, duration: 1 }),
}));

describe("runCodegen", () => {
    const project = setupTempTree("gtkx-run-codegen-");

    it("rejects when no gtkx.config.ts is present, naming the directory searched", async () => {
        installRuntimePackage(project.path);
        await expect(runCodegen({ cwd: project.path })).rejects.toThrow(missingConfigMessage(project.path));
    });

    it("falls back to process.cwd() when options.cwd is omitted", async () => {
        installRuntimePackage(project.path);
        writeConfig(project.path);
        const originalCwd = process.cwd();
        process.chdir(project.path);

        try {
            const result = await runCodegen();
            expect(result.configFile).toBeDefined();
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("with force, removes the gi store before regenerating", async () => {
        installRuntimePackage(project.path);
        writeConfig(project.path);
        writeDefaultGiBarrels(project.path);
        const giStale = join(project.path, "node_modules", ".gtkx", "gi", "stale.js");
        writeFileSync(giStale, "");
        const result = await runCodegen({ cwd: project.path, isForced: true });
        expect(existsSync(giStale)).toBe(false);
        expect(result.namespaces).toBe(1);
    });
});

describe("runCodegen — force in a hoisted workspace", () => {
    const workspace = setupTempTree("gtkx-codegen-forced-", "packages", "app");

    it("keeps the shared jsx store a project without React never regenerates", async () => {
        installRuntimePackage(workspace.path);
        writeDefaultGiBarrels(workspace.path);
        writeJsxStore(workspace.path);

        writeConfig(
            workspace.child,
            `export default { applicationId: "org.gtk.Test", girPath: ["${workspace.child}"] };`,
        );

        await runCodegen({ cwd: workspace.child, isForced: true });
        expect(existsSync(join(workspace.path, "node_modules", ".gtkx", "gi"))).toBe(false);
        expect(existsSync(join(workspace.path, "node_modules", ".gtkx", "jsx"))).toBe(true);
        expect(existsSync(join(workspace.path, "node_modules", "@gtkx", "jsx"))).toBe(true);
    });
});

describe("runCodegen — codegen: false", () => {
    const workspace = setupTempTree("gtkx-codegen-disabled-", "packages", "app");

    it("removes the stores under the project's own node_modules", async () => {
        installRuntimePackage(workspace.child);
        writeDisabledConfig(workspace.child);
        writeDefaultGiBarrels(workspace.child);
        writeJsxStore(workspace.child);
        await runCodegen({ cwd: workspace.child });
        expect(existsSync(join(workspace.child, "node_modules", ".gtkx", "gi"))).toBe(false);
        expect(existsSync(join(workspace.child, "node_modules", "@gtkx", "jsx"))).toBe(false);
    });

    it("keeps the hoisted store the project consumes", async () => {
        installRuntimePackage(workspace.path);
        installReactStack(workspace.path);
        writeDefaultGiBarrels(workspace.path);
        writeJsxStore(workspace.path);
        writeDisabledConfig(workspace.child);
        writeGiBarrel(workspace.child, "gtk");
        await runCodegen({ cwd: workspace.child });
        expect(existsSync(join(workspace.path, "node_modules", ".gtkx", "gi"))).toBe(true);
        expect(existsSync(join(workspace.path, "node_modules", ".gtkx", "jsx"))).toBe(true);
        expect(existsSync(join(workspace.child, "node_modules", ".gtkx", "gi"))).toBe(false);
    });
});

describe("ensureGenerated — announce path", () => {
    const project = setupTempTree("gtkx-announce-");
    restorePreflightEnv();

    it("skips codegen silently when GTKX_DISABLE_PREFLIGHT=1", async () => {
        process.env.GTKX_DISABLE_PREFLIGHT = "1";
        writeConfig(project.path);
        expect(await announceLogs(project.path)).toBe("");
    });

    it("does not read the configuration at all when GTKX_DISABLE_PREFLIGHT=1", async () => {
        process.env.GTKX_DISABLE_PREFLIGHT = "1";
        expect(await ensureGenerated(project.path, { shouldAnnounce: true })).toBe(false);
    });

    it("rejects when there is no gtkx.config.ts", async () => {
        installRuntimePackage(project.path);
        await expectMissingConfig(project.path);
    });

    it("runs codegen when the gi store is missing", async () => {
        installRuntimePackage(project.path);
        writeConfig(project.path);
        expect(await announceLogs(project.path)).toContain("running codegen");
    });

    it("skips codegen when the gi and jsx stores are present", async () => {
        installRuntimePackage(project.path);
        installReactStack(project.path);
        writeConfig(project.path);
        writeDefaultGiBarrels(project.path);
        writeJsxStore(project.path);
        writeFingerprint(project.path);
        expect(await announceLogs(project.path)).toBe("");
    });
});

describe("ensureGeneratedIn", () => {
    const project = setupTempTree("gtkx-ensure-in-");
    restorePreflightEnv();

    it("generates from the given context without reading a configuration file", async () => {
        installReactProject(project.path);
        rmSync(join(project.path, "gtkx.config.ts"), { force: true });
        expect(await ensureGeneratedIn(contextFor(project.path), { shouldAnnounce: true })).toBe(true);
    });

    it("skips codegen when GTKX_DISABLE_PREFLIGHT=1", async () => {
        process.env.GTKX_DISABLE_PREFLIGHT = "1";
        installReactProject(project.path);
        expect(await ensureGeneratedIn(contextFor(project.path), { shouldAnnounce: true })).toBe(false);
    });
});

describe("ensureGenerated", () => {
    const project = setupTempTree("gtkx-ensure-");

    it("regenerates when the jsx unit is missing", async () => {
        installReactProject(project.path);
        expect(await ensureGenerated(project.path)).toBe(true);
    });

    it("does nothing when the gi and jsx stores are present", async () => {
        installGeneratedProject(project.path);
        expect(await ensureGenerated(project.path)).toBe(false);
    });

    it("does not wedge on a missing jsx unit when the react runtime is absent", async () => {
        installRuntimePackage(project.path);
        installPackage(project.path, "react");
        writeConfig(project.path);
        writeDefaultGiBarrels(project.path);
        writeFingerprint(project.path);
        expect(await ensureGenerated(project.path)).toBe(false);
    });

    it("rejects when there is no gtkx.config.ts", async () => {
        installRuntimePackage(project.path);
        await expect(ensureGenerated(project.path)).rejects.toThrow(missingConfigMessage(project.path));
    });

    it("propagates non-NotFound config errors", async () => {
        installRuntimePackage(project.path);
        writeConfig(project.path, "export default { libraries: [] };");
        await expect(ensureGenerated(project.path)).rejects.toThrow();
    });
});

describe("ensureGenerated — store links", () => {
    const project = setupTempTree("gtkx-ensure-links-");

    it("regenerates when the gi store link is pruned", async () => {
        installReactProject(project.path);
        writeJsxStore(project.path);
        rmSync(join(project.path, "node_modules", "@gtkx", "gi"), { recursive: true, force: true });
        expect(await ensureGenerated(project.path)).toBe(true);
    });

    it("regenerates when the jsx store link is pruned", async () => {
        installGeneratedProject(project.path);
        rmSync(join(project.path, "node_modules", "@gtkx", "jsx"), { recursive: true, force: true });
        expect(await ensureGenerated(project.path)).toBe(true);
    });

    it("regenerates when a store manifest is pruned but its modules remain", async () => {
        installGeneratedProject(project.path);
        rmSync(join(project.path, "node_modules", ".gtkx", "jsx", "package.json"), { force: true });
        expect(await ensureGenerated(project.path)).toBe(true);
    });
});

describe("syncSchemaEnv", () => {
    const project = setupTempTree("gtkx-sync-schema-env-");

    it("writes the declaration file for a project that declares no data directory", () => {
        writeFileSync(join(project.path, "package.json"), JSON.stringify({ name: "app", version: "0.0.0" }));
        syncSchemaEnv(project.path);
        expect(existsSync(join(project.path, "node_modules", ".gtkx", "env.d.ts"))).toBe(true);
    });
});

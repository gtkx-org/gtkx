import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStorePaths, resolveStore } from "../../src/store/resolve-store.js";

type WorkspaceRef = { root: string; app: string; hoisted: string };

const REACT_EXPORTS: Record<string, unknown> = {
    ".": "./index.js",
    "./package.json": "./package.json",
    "./config": "./config.js",
    "./internal": "./internal.js",
};

const markInstallRoot = (root: string): void => {
    writeFileSync(join(root, "package-lock.json"), "{}");
};

const setupWorkspace = (prefix: string): WorkspaceRef => {
    const ref: WorkspaceRef = { root: "", app: "", hoisted: "" };

    beforeEach(() => {
        ref.root = mkdtempSync(join(tmpdir(), prefix));
        ref.app = join(ref.root, "packages", "app");
        ref.hoisted = join(ref.root, "node_modules");
        mkdirSync(ref.app, { recursive: true });
        markInstallRoot(ref.root);
    });

    afterEach(() => {
        rmSync(ref.root, { recursive: true, force: true });
    });

    return ref;
};

const installPackage = (root: string, name: string, version = "1.2.3", exports?: Record<string, unknown>): string => {
    const dir = join(root, "node_modules", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, main: "./index.js", exports }));
    writeFileSync(join(dir, "index.js"), "");

    return dir;
};

describe("resolveStore", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "gtkx-resolve-store-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it("places both stores under the project node_modules", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        installPackage(projectRoot, "@gtkx/react");
        const nodeModules = join(projectRoot, "node_modules");
        const store = resolveStore(projectRoot);
        expect(store.nodeModules).toBe(nodeModules);
        expect(store.gi.storeDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsx?.linkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("versions the gi store from @gtkx/runtime and the jsx store from @gtkx/react", () => {
        installPackage(projectRoot, "@gtkx/runtime", "9.9.9");
        installPackage(projectRoot, "@gtkx/react", "4.5.6");
        const store = resolveStore(projectRoot);
        expect(store.gi.version).toBe("9.9.9");
        expect(store.jsx?.version).toBe("4.5.6");
    });

    it("reads the React subexport names from its exports map", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        installPackage(projectRoot, "@gtkx/react", "1.0.0", REACT_EXPORTS);
        expect(resolveStore(projectRoot).reactSubexports).toEqual(["config", "internal"]);
    });

    it("reports no jsx store when @gtkx/react is absent", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        const store = resolveStore(projectRoot);
        expect(store.jsx).toBeNull();
        expect(store.reactSubexports).toEqual([]);
    });

    it("throws when @gtkx/runtime cannot be resolved", () => {
        expect(() => resolveStore(projectRoot)).toThrow(/Cannot resolve @gtkx\/runtime/);
    });
});

describe("resolveStore hoisting", () => {
    const workspace = setupWorkspace("gtkx-resolve-store-hoisted-");

    it("places both stores in the node_modules the packages were hoisted to", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        installPackage(workspace.root, "@gtkx/react");
        const store = resolveStore(workspace.app);
        expect(store.nodeModules).toBe(workspace.hoisted);
        expect(store.gi.storeDir).toBe(join(workspace.hoisted, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(workspace.hoisted, "@gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(workspace.hoisted, ".gtkx", "jsx"));
        expect(store.jsx?.linkDir).toBe(join(workspace.hoisted, "@gtkx", "jsx"));
    });

    it("walks up to a workspace root that only declares its packages", () => {
        writeFileSync(join(workspace.root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
        rmSync(join(workspace.root, "package-lock.json"));
        installPackage(workspace.root, "@gtkx/runtime");
        installPackage(workspace.root, "@gtkx/react");
        expect(resolveStore(workspace.app).nodeModules).toBe(workspace.hoisted);
    });

    it("keeps the jsx store with the gi store when @gtkx/react is not hoisted", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.app, "node_modules", ".gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(workspace.app, "node_modules", ".gtkx", "jsx"));
    });

    it("rejects an install whose @gtkx/runtime the store could not import", () => {
        installPackage(workspace.root, "@gtkx/react");
        installPackage(workspace.app, "@gtkx/runtime");

        expect(() => resolveStore(workspace.app)).toThrow(
            /Install @gtkx\/react and @gtkx\/runtime in the same node_modules/,
        );
    });
});

describe("resolveStore hoisting overrides", () => {
    const workspace = setupWorkspace("gtkx-resolve-store-linked-");

    it("prefers the nearest node_modules over the hoisted one", () => {
        installPackage(workspace.root, "@gtkx/runtime", "1.0.0");
        installPackage(workspace.app, "@gtkx/runtime", "2.0.0");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.app, "node_modules", ".gtkx", "gi"));
        expect(store.gi.version).toBe("2.0.0");
    });

    it("anchors the store at the link rather than at the package's real path", () => {
        const runtime = installPackage(join(workspace.root, "isolated"), "@gtkx/runtime");
        mkdirSync(join(workspace.hoisted, "@gtkx"), { recursive: true });
        symlinkSync(runtime, join(workspace.hoisted, "@gtkx", "runtime"), "dir");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.hoisted, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(workspace.hoisted, "@gtkx", "gi"));
    });
});

describe("resolveStore install root", () => {
    let outerRoot: string;
    let projectRoot: string;

    beforeEach(() => {
        outerRoot = mkdtempSync(join(tmpdir(), "gtkx-resolve-store-outer-"));
        projectRoot = join(outerRoot, "nested", "app");
        mkdirSync(projectRoot, { recursive: true });
        markInstallRoot(outerRoot);
        installPackage(outerRoot, "@gtkx/runtime");
        installPackage(outerRoot, "@gtkx/react");
    });

    afterEach(() => {
        rmSync(outerRoot, { recursive: true, force: true });
    });

    it("refuses to write into an installation the project only sits below", () => {
        markInstallRoot(projectRoot);

        expect(() => resolveStore(projectRoot)).toThrow(
            new RegExp(`the nearest one is installed in ${join(outerRoot, "node_modules")}, outside the install root`),
        );
    });

    it("uses the outer installation when the project declares no install root of its own", () => {
        expect(resolveStore(projectRoot).nodeModules).toBe(join(outerRoot, "node_modules"));
    });

    it("walks to the nearest installation when nothing declares an install root", () => {
        rmSync(join(outerRoot, "package-lock.json"));
        expect(resolveStore(projectRoot).nodeModules).toBe(join(outerRoot, "node_modules"));
    });
});

describe("getStorePaths", () => {
    it("lists both store directories and both links in one node_modules", () => {
        const nodeModules = join(tmpdir(), "gtkx-store-paths", "node_modules");

        expect(getStorePaths(nodeModules)).toEqual([
            join(nodeModules, ".gtkx", "gi"),
            join(nodeModules, "@gtkx", "gi"),
            join(nodeModules, ".gtkx", "jsx"),
            join(nodeModules, "@gtkx", "jsx"),
        ]);
    });
});

describe("resolveStore isolation", () => {
    it("ignores NODE_PATH and the global folders", () => {
        const projectRoot = mkdtempSync(join(tmpdir(), "gtkx-resolve-store-"));
        const runtimeDir = join(projectRoot, "node_modules", "@gtkx", "runtime");
        mkdirSync(runtimeDir, { recursive: true });
        writeFileSync(join(runtimeDir, "package.json"), JSON.stringify({ name: "@gtkx/runtime", version: "1.0.0" }));
        process.env.NODE_PATH = join(process.cwd(), "node_modules");

        try {
            expect(resolveStore(projectRoot).jsx).toBeNull();
        } finally {
            rmSync(projectRoot, { recursive: true, force: true });
        }
    });
});

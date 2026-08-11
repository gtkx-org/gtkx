import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveStore } from "../../src/store/resolve-store.js";

const REACT_EXPORTS: Record<string, unknown> = {
    ".": "./index.js",
    "./package.json": "./package.json",
    "./config": "./config.js",
    "./internal": "./internal.js",
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
    let workspaceRoot: string;
    let appRoot: string;
    let hoistedModules: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "gtkx-resolve-store-hoisted-"));
        appRoot = join(workspaceRoot, "packages", "app");
        hoistedModules = join(workspaceRoot, "node_modules");
        mkdirSync(appRoot, { recursive: true });
    });

    afterEach(() => {
        rmSync(workspaceRoot, { recursive: true, force: true });
    });

    it("places both stores in the node_modules the packages were hoisted to", () => {
        installPackage(workspaceRoot, "@gtkx/runtime");
        installPackage(workspaceRoot, "@gtkx/react");
        const store = resolveStore(appRoot);
        expect(store.gi.storeDir).toBe(join(hoistedModules, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(hoistedModules, "@gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(hoistedModules, ".gtkx", "jsx"));
        expect(store.jsx?.linkDir).toBe(join(hoistedModules, "@gtkx", "jsx"));
    });

    it("prefers the nearest node_modules over the hoisted one", () => {
        installPackage(workspaceRoot, "@gtkx/runtime", "1.0.0");
        installPackage(appRoot, "@gtkx/runtime", "2.0.0");
        const store = resolveStore(appRoot);
        expect(store.gi.storeDir).toBe(join(appRoot, "node_modules", ".gtkx", "gi"));
        expect(store.gi.version).toBe("2.0.0");
    });

    it("anchors the store at the link rather than at the package's real path", () => {
        const runtime = installPackage(join(workspaceRoot, "isolated"), "@gtkx/runtime");
        mkdirSync(join(hoistedModules, "@gtkx"), { recursive: true });
        symlinkSync(runtime, join(hoistedModules, "@gtkx", "runtime"), "dir");
        const store = resolveStore(appRoot);
        expect(store.gi.storeDir).toBe(join(hoistedModules, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(hoistedModules, "@gtkx", "gi"));
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

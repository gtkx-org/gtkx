import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStorePaths, resolveStore } from "../../src/store/resolve-store.js";

type WorkspaceRef = { root: string; app: string; hoisted: string; nested: string };

const REACT_EXPORTS: Record<string, unknown> = {
    ".": "./index.js",
    "./package.json": "./package.json",
    "./config": "./config.js",
    "./internal": "./internal.js",
};

const setupWorkspace = (prefix: string): WorkspaceRef => {
    const ref: WorkspaceRef = { root: "", app: "", hoisted: "", nested: "" };

    beforeEach(() => {
        ref.root = mkdtempSync(join(tmpdir(), prefix));
        ref.app = join(ref.root, "packages", "app");
        ref.hoisted = join(ref.root, "node_modules");
        ref.nested = join(ref.app, "node_modules");
        mkdirSync(ref.app, { recursive: true });
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
        installPackage(workspace.root, "@gtkx/cli");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.hoisted, ".gtkx", "gi"));
        expect(store.gi.linkDir).toBe(join(workspace.hoisted, "@gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(workspace.hoisted, ".gtkx", "jsx"));
        expect(store.jsx?.linkDir).toBe(join(workspace.hoisted, "@gtkx", "jsx"));
    });

    it("keeps both stores in the project's own node_modules when every @gtkx package is there", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");
        installPackage(workspace.app, "@gtkx/cli");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.nested, ".gtkx", "gi"));
        expect(store.jsx?.storeDir).toBe(join(workspace.nested, ".gtkx", "jsx"));
    });

    it("ignores an ancestor whose package.json cannot be parsed", () => {
        writeFileSync(join(workspace.root, "package.json"), "");
        installPackage(workspace.app, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");
        expect(resolveStore(workspace.app).gi.storeDir).toBe(join(workspace.nested, ".gtkx", "gi"));
    });
});

describe("resolveStore split installs", () => {
    const workspace = setupWorkspace("gtkx-resolve-store-split-");

    it("rejects an install whose @gtkx/cli sits above the store", () => {
        installPackage(workspace.root, "@gtkx/cli");
        installPackage(workspace.app, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");

        expect(() => resolveStore(workspace.app)).toThrow(
            `Cannot write the generated store to ${workspace.nested}: @gtkx/cli is installed in ` +
            `${workspace.hoisted}, above it, so that copy can never import the generated @gtkx/gi.`,
        );
    });

    it("rejects an install whose @gtkx/react sits above the store", () => {
        installPackage(workspace.root, "@gtkx/react");
        installPackage(workspace.app, "@gtkx/runtime");

        expect(() => resolveStore(workspace.app)).toThrow(
            `Cannot write the generated store to ${workspace.nested}: @gtkx/react is installed in ` +
            `${workspace.hoisted}, above it`,
        );
    });

    it("rejects an install whose @gtkx/testing sits above the store", () => {
        installPackage(workspace.root, "@gtkx/testing");
        installPackage(workspace.app, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");
        expect(() => resolveStore(workspace.app)).toThrow(/@gtkx\/testing is installed in/);
    });
});

describe("resolveStore hoisting overrides", () => {
    const workspace = setupWorkspace("gtkx-resolve-store-linked-");

    it("prefers the nearest node_modules over the hoisted one", () => {
        installPackage(workspace.root, "@gtkx/runtime", "1.0.0");
        installPackage(workspace.app, "@gtkx/runtime", "2.0.0");
        const store = resolveStore(workspace.app);
        expect(store.gi.storeDir).toBe(join(workspace.nested, ".gtkx", "gi"));
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

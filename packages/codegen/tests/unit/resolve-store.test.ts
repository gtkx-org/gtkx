import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getShadowingStorePaths, resolveStore, sweepProjectStaging } from "../../src/store/resolve-store.js";
import { runningStagingName, strandedStagingName } from "../helpers/staging.js";

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

const stageStoreDir = (nodeModules: string, name: string): string => {
    const staged = join(nodeModules, ".gtkx", name);
    mkdirSync(staged, { recursive: true });

    return staged;
};

const unreachableConsumer = (workspace: WorkspaceRef, consumer: string): string =>
    `Cannot write the generated store to ${workspace.nested}: ${consumer} is installed in ` +
    `${workspace.hoisted}, above it`;

const installReactAboveRuntime = (workspace: WorkspaceRef): void => {
    installPackage(workspace.root, "@gtkx/react");
    installPackage(workspace.app, "@gtkx/runtime");
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
        const message = unreachableConsumer(workspace, "@gtkx/cli");

        expect(() => resolveStore(workspace.app)).toThrow(
            `${message}, so that copy can never import the generated @gtkx/gi.`,
        );
    });

    it("rejects an install whose @gtkx/react sits above the store", () => {
        installReactAboveRuntime(workspace);
        expect(() => resolveStore(workspace.app)).toThrow(unreachableConsumer(workspace, "@gtkx/react"));
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

describe("sweepProjectStaging", () => {
    const workspace = setupWorkspace("gtkx-sweep-project-staging-");

    it("removes what a killed run stranded where the store is anchored and where the project sits", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        const hoisted = stageStoreDir(workspace.hoisted, strandedStagingName("gi"));
        const nested = stageStoreDir(workspace.nested, strandedStagingName("jsx"));
        sweepProjectStaging(workspace.app);
        expect(existsSync(hoisted)).toBe(false);
        expect(existsSync(nested)).toBe(false);
    });

    it("removes what a killed run stranded even when no @gtkx/runtime resolves", () => {
        const stranded = stageStoreDir(workspace.nested, strandedStagingName("gi"));
        sweepProjectStaging(workspace.app);
        expect(existsSync(stranded)).toBe(false);
    });

    it("keeps the generated stores and the staging directory of a run still going", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        const store = stageStoreDir(workspace.hoisted, "gi");
        const running = stageStoreDir(workspace.hoisted, runningStagingName("gi"));
        sweepProjectStaging(workspace.app);
        expect(existsSync(store)).toBe(true);
        expect(existsSync(running)).toBe(true);
    });
});

describe("getShadowingStorePaths", () => {
    const workspace = setupWorkspace("gtkx-shadowing-store-paths-");

    it("lists both store directories and both links when the store resolves above the project", () => {
        installPackage(workspace.root, "@gtkx/runtime");
        installPackage(workspace.root, "@gtkx/react");

        expect(getShadowingStorePaths(workspace.app)).toEqual([
            join(workspace.nested, ".gtkx", "gi"),
            join(workspace.nested, "@gtkx", "gi"),
            join(workspace.nested, ".gtkx", "jsx"),
            join(workspace.nested, "@gtkx", "jsx"),
        ]);
    });

    it("lists nothing when the project's own node_modules is where the store belongs", () => {
        installPackage(workspace.app, "@gtkx/runtime");
        installPackage(workspace.app, "@gtkx/react");
        expect(getShadowingStorePaths(workspace.app)).toEqual([]);
    });

    it("lists nothing when the project installs @gtkx/runtime itself under a hoisted @gtkx/react", () => {
        installReactAboveRuntime(workspace);
        expect(getShadowingStorePaths(workspace.app)).toEqual([]);
    });

    it("lists nothing when @gtkx/runtime cannot be resolved", () => {
        expect(getShadowingStorePaths(workspace.app)).toEqual([]);
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

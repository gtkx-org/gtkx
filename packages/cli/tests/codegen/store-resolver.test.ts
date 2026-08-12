import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCodegenStore } from "../../src/codegen/store-resolver.js";
import { setupWorkspace } from "./workspace-fixture.js";

const HOISTED_PACKAGES: string[] = ["@gtkx/native", "@gtkx/runtime", "@gtkx/react", "react"];

const installPackage = (root: string, name: string, version = "1.2.3"): void => {
    const pkgDir = join(root, "node_modules", name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name, version, main: "./index.js" }));
    writeFileSync(join(pkgDir, "index.js"), "");
};

describe("resolveCodegenStore", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "gtkx-store-"));
        installPackage(projectRoot, "@gtkx/native");
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it("resolves the store and alias directories under the project node_modules", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        const store = resolveCodegenStore(projectRoot);
        const nodeModules = join(projectRoot, "node_modules");
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.giLinkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsxLinkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("resolves @gtkx/runtime's version", () => {
        installPackage(projectRoot, "@gtkx/runtime", "9.9.9");
        const store = resolveCodegenStore(projectRoot);
        expect(store.runtimeVersion).toBe("9.9.9");
    });

    it("resolves a locally installed @gtkx/react's version when the React runtime is present", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        installPackage(projectRoot, "react");
        installPackage(projectRoot, "@gtkx/react", "4.5.6");
        const store = resolveCodegenStore(projectRoot);
        expect(store.react?.version).toBe("4.5.6");
    });

    it("returns a string runtime version and a null-or-object React entry", () => {
        installPackage(projectRoot, "@gtkx/runtime");
        const store = resolveCodegenStore(projectRoot);
        expect(typeof store.runtimeVersion).toBe("string");
        expect(store.react === null || typeof store.react.version === "string").toBe(true);
    });
});

describe("resolveCodegenStore hoisting", () => {
    const workspace = setupWorkspace("gtkx-store-hoisted-");

    beforeEach(() => {
        for (const name of HOISTED_PACKAGES) {
            installPackage(workspace.root, name);
        }
    });

    it("resolves both stores in the node_modules the packages were hoisted to", () => {
        const nodeModules = join(workspace.root, "node_modules");
        const store = resolveCodegenStore(workspace.app);
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.giLinkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsxLinkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("keeps both stores beside the project's own @gtkx/react", () => {
        installPackage(workspace.app, "@gtkx/react", "4.5.6");
        const nodeModules = join(workspace.app, "node_modules");
        const store = resolveCodegenStore(workspace.app);
        expect(store.react?.version).toBe("4.5.6");
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
    });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveCodegenStore } from "../../src/codegen/store-resolver.js";
import { setupTempTree } from "../temp-tree.js";

const HOISTED_PACKAGES: string[] = ["@gtkx/native", "@gtkx/runtime", "@gtkx/react", "react"];

const installPackage = (root: string, name: string, version = "1.2.3"): void => {
    const pkgDir = join(root, "node_modules", name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name, version, main: "./index.js" }));
    writeFileSync(join(pkgDir, "index.js"), "");
};

describe("resolveCodegenStore", () => {
    const project = setupTempTree("gtkx-store-");

    beforeEach(() => {
        installPackage(project.path, "@gtkx/native");
    });

    it("resolves the store and alias directories under the project node_modules", () => {
        installPackage(project.path, "@gtkx/runtime");
        const store = resolveCodegenStore(project.path);
        const nodeModules = join(project.path, "node_modules");
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.giLinkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsxLinkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("resolves @gtkx/runtime's version", () => {
        installPackage(project.path, "@gtkx/runtime", "9.9.9");
        const store = resolveCodegenStore(project.path);
        expect(store.runtimeVersion).toBe("9.9.9");
    });

    it("resolves a locally installed @gtkx/react's version when the React runtime is present", () => {
        installPackage(project.path, "@gtkx/runtime");
        installPackage(project.path, "react");
        installPackage(project.path, "@gtkx/react", "4.5.6");
        const store = resolveCodegenStore(project.path);
        expect(store.react?.version).toBe("4.5.6");
    });

    it("returns a string runtime version and a null-or-object React entry", () => {
        installPackage(project.path, "@gtkx/runtime");
        const store = resolveCodegenStore(project.path);
        expect(typeof store.runtimeVersion).toBe("string");
        expect(store.react === null || typeof store.react.version === "string").toBe(true);
    });
});

describe("resolveCodegenStore hoisting", () => {
    const workspace = setupTempTree("gtkx-store-hoisted-", "packages", "app");

    beforeEach(() => {
        for (const name of HOISTED_PACKAGES) {
            installPackage(workspace.path, name);
        }
    });

    it("resolves both stores in the node_modules the packages were hoisted to", () => {
        const nodeModules = join(workspace.path, "node_modules");
        const store = resolveCodegenStore(workspace.child);
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.giLinkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsxLinkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("keeps both stores beside the project's own @gtkx/react", () => {
        installPackage(workspace.child, "@gtkx/react", "4.5.6");
        const nodeModules = join(workspace.child, "node_modules");
        const store = resolveCodegenStore(workspace.child);
        expect(store.react?.version).toBe("4.5.6");
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
    });
});

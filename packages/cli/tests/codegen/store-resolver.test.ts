import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCodegenStore } from "../../src/codegen/store-resolver.js";

describe("resolveCodegenStore", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "gtkx-store-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    function installPackage(name: string, version = "1.2.3"): string {
        const pkgDir = join(projectRoot, "node_modules", name);
        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name, version, main: "./index.js" }));
        writeFileSync(join(pkgDir, "index.js"), "");
        return pkgDir;
    }

    it("resolves the store and alias directories under the project node_modules", () => {
        installPackage("@gtkx/ffi");
        const store = resolveCodegenStore(projectRoot);
        const nodeModules = join(projectRoot, "node_modules");
        expect(store.giStoreDir).toBe(join(nodeModules, ".gtkx", "gi"));
        expect(store.giLinkDir).toBe(join(nodeModules, "@gtkx", "gi"));
        expect(store.jsxStoreDir).toBe(join(nodeModules, ".gtkx", "jsx"));
        expect(store.jsxLinkDir).toBe(join(nodeModules, "@gtkx", "jsx"));
    });

    it("resolves @gtkx/ffi's real directory and version", () => {
        const ffiDir = installPackage("@gtkx/ffi", "9.9.9");
        const store = resolveCodegenStore(projectRoot);
        expect(store.realFfiDir).toBe(ffiDir);
        expect(store.ffiVersion).toBe("9.9.9");
    });

    it("resolves a locally installed @gtkx/react's real directory and version", () => {
        installPackage("@gtkx/ffi");
        const reactDir = installPackage("@gtkx/react", "4.5.6");
        const store = resolveCodegenStore(projectRoot);
        expect(store.react?.realDir).toBe(reactDir);
        expect(store.react?.version).toBe("4.5.6");
    });

    it("returns a string ffi dir and a string-or-null React dir", () => {
        installPackage("@gtkx/ffi");
        const store = resolveCodegenStore(projectRoot);
        expect(typeof store.realFfiDir).toBe("string");
        expect(store.react === null || typeof store.react.realDir === "string").toBe(true);
    });
});

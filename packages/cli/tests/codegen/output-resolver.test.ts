import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveOutputDirs } from "../../src/codegen/output-resolver.js";

describe("resolveOutputDirs", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "gtkx-output-resolver-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    function installPackage(name: string): string {
        const pkgDir = join(projectRoot, "node_modules", name);
        mkdirSync(pkgDir, { recursive: true });
        const pkgJson = { name, version: "0.0.0", main: "./index.js" };
        writeFileSync(join(pkgDir, "package.json"), JSON.stringify(pkgJson));
        writeFileSync(join(pkgDir, "index.js"), "");
        return pkgDir;
    }

    it("resolves the FFI output directory under the locally installed @gtkx/ffi", () => {
        const ffiDir = installPackage("@gtkx/ffi");
        const result = resolveOutputDirs(projectRoot);
        expect(result.ffiOutputDir).toBe(join(ffiDir, "dist", "generated"));
    });

    it("resolves the React output directory under the locally installed @gtkx/react", () => {
        installPackage("@gtkx/ffi");
        const reactDir = installPackage("@gtkx/react");
        const result = resolveOutputDirs(projectRoot);
        expect(result.reactOutputDir).toBe(join(reactDir, "dist", "generated"));
    });

    it("returns a string FFI dir and either a string or null React dir", () => {
        installPackage("@gtkx/ffi");
        const result = resolveOutputDirs(projectRoot);
        expect(typeof result.ffiOutputDir).toBe("string");
        expect(result.reactOutputDir === null || typeof result.reactOutputDir === "string").toBe(true);
    });

    it("places generated dirs under the resolved package directory", () => {
        const ffiDir = installPackage("@gtkx/ffi");
        const result = resolveOutputDirs(projectRoot);
        expect(result.ffiOutputDir.startsWith(dirname(ffiDir))).toBe(true);
        expect(result.ffiOutputDir.endsWith(join("dist", "generated"))).toBe(true);
    });
});

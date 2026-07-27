import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDataDir } from "../../src/internal/data-dir.js";

const writeManifest = (root: string, manifest: unknown): void => {
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
};

describe("resolveDataDir", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-data-dir-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("reads the directory from a string #data/* imports target", () => {
        writeManifest(root, { imports: { "#data/*": "./data/*" } });
        expect(resolveDataDir(root)).toBe("data");
    });

    it("supports a nested target directory", () => {
        writeManifest(root, { imports: { "#data/*": "./src/assets/*" } });
        expect(resolveDataDir(root)).toBe("src/assets");
    });

    it("reads the target from a conditional object entry", () => {
        writeManifest(root, { imports: { "#data/*": { default: "./resources/*" } } });
        expect(resolveDataDir(root)).toBe("resources");
    });

    it("returns null when there is no #data/* entry", () => {
        writeManifest(root, { imports: { "#other/*": "./other/*" } });
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null when there is no imports map", () => {
        writeManifest(root, { name: "app" });
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null when no package.json exists", () => {
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null for a malformed target without the /* glob", () => {
        writeManifest(root, { imports: { "#data/*": "./data" } });
        expect(resolveDataDir(root)).toBeNull();
    });
});

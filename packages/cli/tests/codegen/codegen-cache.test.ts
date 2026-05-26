import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeInputHash, isCacheValid, writeCacheManifest } from "../../src/codegen/codegen-cache.js";

const CACHE_REL_DIR = join("node_modules", ".cache", "gtkx");
const MANIFEST_FILE = "codegen-manifest.json";

describe("computeInputHash", () => {
    it("produces a stable hex digest for identical inputs", () => {
        const hash1 = computeInputHash(["Gtk-4.0"], ["/a"], undefined, "1.0.0");
        const hash2 = computeInputHash(["Gtk-4.0"], ["/a"], undefined, "1.0.0");

        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("changes when libraries change", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0", "Adw-1"], undefined, undefined, "1.0.0");
        expect(a).not.toBe(b);
    });

    it("changes when girPath changes", () => {
        const a = computeInputHash(["Gtk-4.0"], ["/a"], undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], ["/b"], undefined, "1.0.0");
        expect(a).not.toBe(b);
    });

    it("treats undefined and empty girPath identically", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], [], undefined, "1.0.0");
        expect(a).toBe(b);
    });

    it("changes when codegen version changes", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.1");
        expect(a).not.toBe(b);
    });

    it("changes when slotProps change", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], undefined, { MyAppFooBar: ["content"] }, "1.0.0");
        expect(a).not.toBe(b);
    });

    it("treats undefined and empty slotProps identically", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, undefined, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], undefined, {}, "1.0.0");
        expect(a).toBe(b);
    });

    it("is insensitive to slotProps key and entry ordering", () => {
        const a = computeInputHash(["Gtk-4.0"], undefined, { AdwFoo: ["a", "b"], MyAppBar: ["x"] }, "1.0.0");
        const b = computeInputHash(["Gtk-4.0"], undefined, { MyAppBar: ["x"], AdwFoo: ["b", "a"] }, "1.0.0");
        expect(a).toBe(b);
    });
});

describe("isCacheValid", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "codegen-cache-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it("returns false when no manifest exists", () => {
        expect(isCacheValid(projectRoot, "abc")).toBe(false);
    });

    it("returns true when the manifest hash matches", () => {
        writeCacheManifest(projectRoot, "abc", "1.0.0");
        expect(isCacheValid(projectRoot, "abc")).toBe(true);
    });

    it("returns false when the manifest hash differs", () => {
        writeCacheManifest(projectRoot, "abc", "1.0.0");
        expect(isCacheValid(projectRoot, "xyz")).toBe(false);
    });

    it("returns false when the manifest is malformed", () => {
        const cachePath = join(projectRoot, CACHE_REL_DIR);
        mkdirSync(cachePath, { recursive: true });
        writeFileSync(join(cachePath, MANIFEST_FILE), "not json");
        expect(isCacheValid(projectRoot, "abc")).toBe(false);
    });
});

describe("writeCacheManifest", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "codegen-cache-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it("creates the cache directory and writes the manifest", () => {
        writeCacheManifest(projectRoot, "abc", "1.0.0");

        const manifestPath = join(projectRoot, CACHE_REL_DIR, MANIFEST_FILE);
        expect(existsSync(manifestPath)).toBe(true);

        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
        expect(parsed).toMatchObject({ inputHash: "abc", codegenVersion: "1.0.0" });
        expect(typeof parsed.timestamp).toBe("number");
    });

    it("overwrites a pre-existing manifest", () => {
        writeCacheManifest(projectRoot, "first", "1.0.0");
        writeCacheManifest(projectRoot, "second", "1.0.1");

        const manifestPath = join(projectRoot, CACHE_REL_DIR, MANIFEST_FILE);
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
        expect(parsed.inputHash).toBe("second");
        expect(parsed.codegenVersion).toBe("1.0.1");
    });
});

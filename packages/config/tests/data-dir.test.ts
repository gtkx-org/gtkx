import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDataDir } from "../src/data-dir.js";

let root: string;

const writeManifest = (manifest: unknown): void => {
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
};

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gtkx-data-dir-"));
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe("resolveDataDir", () => {
    it("reads the directory from a string #data/* imports target", () => {
        writeManifest({ imports: { "#data/*": "./data/*" } });
        expect(resolveDataDir(root)).toBe("data");
    });

    it("supports a nested target directory", () => {
        writeManifest({ imports: { "#data/*": "./src/assets/*" } });
        expect(resolveDataDir(root)).toBe("src/assets");
    });

    it("reads the target from a conditional object entry", () => {
        writeManifest({ imports: { "#data/*": { default: "./resources/*" } } });
        expect(resolveDataDir(root)).toBe("resources");
    });

    it("returns null when there is no #data/* entry", () => {
        writeManifest({ imports: { "#other/*": "./other/*" } });
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null when there is no imports map", () => {
        writeManifest({ name: "app" });
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null when no package.json exists", () => {
        expect(resolveDataDir(root)).toBeNull();
    });

    it("returns null for a malformed target without the /* glob", () => {
        writeManifest({ imports: { "#data/*": "./data" } });
        expect(resolveDataDir(root)).toBeNull();
    });
});

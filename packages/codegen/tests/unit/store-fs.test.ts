import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildManifest, writeStore } from "../../src/store/store-fs.js";

describe("writeStore", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-store-fs-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("names the directory it could not write the store into", () => {
        const nodeModules = join(root, "node_modules");
        writeFileSync(nodeModules, "");
        const storeDir = join(nodeModules, ".gtkx", "gi");

        expect(() => {
            writeStore({
                storeDir,
                linkDir: join(nodeModules, "@gtkx", "gi"),
                files: [],
                manifest: buildManifest({ name: "@gtkx/gi", version: "1.0.0", exports: {} }),
            });
        }).toThrow(`Cannot write the generated store to ${storeDir}`);
    });
});

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest, writeStore } from "../../src/store/store-fs.js";

const EMPTY_MODULE = "";
const WORKING_MODULE = "export const answer: number = 42;\n";
const IMPORTER_MODULE = 'import { answer } from "../glib/glib.js";\n\nexport const value: number = answer;\n';
const STRANDED_STAGING_DIR = "gi.tmp-killed";
const roots: string[] = [];

const createRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-store-fs-"));
    roots.push(root);

    return root;
};

const getStoreDir = (root: string): string => join(root, "node_modules", ".gtkx", "gi");
const getFailedStoreDir = (root: string): string => `${getStoreDir(root)}.failed`;

const writeGiStore = (root: string, glibSource: string): void => {
    writeStore({
        storeDir: getStoreDir(root),
        linkDir: join(root, "node_modules", "@gtkx", "gi"),
        files: [
            { fileName: "glib/glib.ts", source: glibSource },
            { fileName: "gdk/gdk.ts", source: IMPORTER_MODULE },
        ],
        manifest: buildManifest({ name: "@gtkx/gi", version: "1.0.0", exports: {} }),
    });
};

const strandStagingDir = (root: string): string => {
    const stranded = join(root, "node_modules", ".gtkx", STRANDED_STAGING_DIR);
    mkdirSync(join(stranded, "glib"), { recursive: true });
    writeFileSync(join(stranded, "glib", "glib.ts"), WORKING_MODULE);

    return stranded;
};

const getBrokenStoreError = (root: string): Error => {
    try {
        writeGiStore(root, EMPTY_MODULE);
    } catch (error) {
        return error as Error;
    }

    throw new Error("expected the store write to fail");
};

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { recursive: true, force: true });
    }

    roots.length = 0;
});

describe("writeStore", () => {
    it("names the directory it could not write the store into", () => {
        const nodeModules = join(createRoot(), "node_modules");
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

describe("writeStore, when a killed run stranded its staging directory", () => {
    it("removes the stranded staging directory", () => {
        const root = createRoot();
        const stranded = strandStagingDir(root);
        writeGiStore(root, WORKING_MODULE);
        expect(existsSync(stranded)).toBe(false);
    });

    it("keeps the siblings that are not staging directories", () => {
        const root = createRoot();
        const storeParent = join(root, "node_modules", ".gtkx");
        strandStagingDir(root);
        mkdirSync(join(storeParent, "jsx"), { recursive: true });
        writeFileSync(join(storeParent, "env.d.ts"), "");
        writeGiStore(root, WORKING_MODULE);
        const entries = readdirSync(storeParent).toSorted((a, b) => a.localeCompare(b));
        expect(entries).toEqual(["env.d.ts", "gi", "jsx"]);
    });
});

describe("writeStore, when the generated store does not type-check", () => {
    it("reports the failure against files that still exist once it returns", () => {
        const root = createRoot();
        const error = getBrokenStoreError(root);
        const kept = join(getFailedStoreDir(root), "glib", "glib.ts");
        expect(error.message).toContain(kept);
        expect(error.message).not.toContain(".tmp-");
        expect(existsSync(kept)).toBe(true);
    });

    it("leaves no temporary store behind", () => {
        const root = createRoot();
        getBrokenStoreError(root);
        const entries = readdirSync(join(root, "node_modules", ".gtkx"));
        expect(entries.filter((entry) => entry.includes(".tmp-"))).toEqual([]);
    });

    it("clears the kept failure once the store is written", () => {
        const root = createRoot();
        getBrokenStoreError(root);
        writeGiStore(root, WORKING_MODULE);
        const compiled = join(getStoreDir(root), "glib", "glib.js");
        expect(existsSync(getFailedStoreDir(root))).toBe(false);
        expect(existsSync(compiled)).toBe(true);
    });
});

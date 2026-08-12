import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkModules, compileProject, type SourceModule } from "../../src/compile.js";
import { compileStore } from "../../src/store/compile-store.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FAILED_CHECK_DIR = ".gtkx-check-failed";
const tempDirs: string[] = [];

const BROKEN_MODULES: SourceModule[] = [
    { fileName: "empty.ts", source: "" },
    { fileName: "importer.ts", source: 'import { gone } from "./empty.js";\n\nexport const use: number = gone;\n' },
];

const createTempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-compile-"));
    tempDirs.push(dir);

    return dir;
};

const checkTestModules = (resolveFrom: string, modules: SourceModule[]): void => {
    checkModules({ modules, resolveFrom, label: "the test modules" });
};

const compileStoreFrom = (files: SourceModule[]): string => {
    const storeDir = createTempDir();

    for (const file of files) {
        const filePath = join(storeDir, file.fileName);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, file.source);
    }

    compileStore({ storeDir, files, packageName: "@gtkx/gi" });

    return storeDir;
};

afterEach(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
    }

    tempDirs.length = 0;
});

describe("compileStore", () => {
    it("emits JS and declarations for modules that import each other through relative paths", () => {
        const storeDir = compileStoreFrom([
            { fileName: "foo/foo.ts", source: "export const answer: number = 42;\n" },
            {
                fileName: "bar/bar.ts",
                source: 'import { answer } from "../foo/foo.js";\nexport const ok: number = answer;\n',
            },
        ]);

        expect(existsSync(join(storeDir, "foo", "foo.js"))).toBe(true);
        expect(existsSync(join(storeDir, "foo", "foo.d.ts"))).toBe(true);
        expect(existsSync(join(storeDir, "bar", "bar.ts"))).toBe(false);
        expect(readFileSync(join(storeDir, "bar", "bar.d.ts"), "utf8")).toContain("export declare const ok: number");
    });

    it("throws with a positioned message when a generated module has a type error", () => {
        expect(() =>
            compileStoreFrom([
                { fileName: "foo/foo.ts", source: "export const answer: number = 42;\n" },
                {
                    fileName: "bar/bar.ts",
                    source: 'import { answer } from "../foo/foo.js";\nexport const wrong: string = answer;\n',
                },
            ]),
        ).toThrow(/bar\/bar\.ts:2:\d+ - Type 'number' is not assignable to type 'string'/);
    });
});

describe("checkModules", () => {
    it("passes for well-typed modules", () => {
        expect(() => {
            checkModules({
                modules: [{ fileName: "ok.ts", source: "export const answer: number = 42;\n" }],
                resolveFrom: REPO_ROOT,
                label: "the test modules",
            });
        },
        ).not.toThrow();
    });

    it("throws with a positioned message on a type error", () => {
        expect(() => {
            checkModules({
                modules: [{ fileName: "bad.ts", source: "export const wrong: string = 42;\n" }],
                resolveFrom: REPO_ROOT,
                label: "the test modules",
            });
        },
        ).toThrow(/bad\.ts:1:\d+ - Type 'number' is not assignable to type 'string'/);
    });
});

describe("checkModules, when the modules do not type-check", () => {
    it("keeps the checked sources at the directory its message names", () => {
        const resolveFrom = createTempDir();
        const kept = join(resolveFrom, "node_modules", FAILED_CHECK_DIR);

        expect(() => {
            checkTestModules(resolveFrom, BROKEN_MODULES);
        }).toThrow(kept);

        const checkDirs = readdirSync(join(resolveFrom, "node_modules"));
        expect(existsSync(join(kept, "empty.ts"))).toBe(true);
        expect(checkDirs.filter((entry) => entry.startsWith(".gtkx-check-"))).toEqual([FAILED_CHECK_DIR]);
    });

    it("removes a kept failure once the modules check out", () => {
        const resolveFrom = createTempDir();

        expect(() => {
            checkTestModules(resolveFrom, BROKEN_MODULES);
        }).toThrow();

        checkTestModules(resolveFrom, [{ fileName: "ok.ts", source: "export const answer: number = 42;\n" }]);
        expect(existsSync(join(resolveFrom, "node_modules", FAILED_CHECK_DIR))).toBe(false);
    });
});

describe("compileProject", () => {
    it("throws when tsc fails without a file-positioned diagnostic", () => {
        const projectDir = createTempDir();
        writeFileSync(join(projectDir, "ok.ts"), "export const answer: number = 42;\n");

        expect(() => {
            compileProject({
                projectDir,
                fileNames: ["ok.ts"],
                compilerOptions: { noEmit: true, types: ["gtkx-missing-types-package"] },
                label: "the test modules",
            });
        },
        ).toThrow(/failed/);
    });
});

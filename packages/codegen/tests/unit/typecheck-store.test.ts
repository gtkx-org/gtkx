import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type StoreSourceFile, typecheckStore } from "../../src/store/typecheck.js";

const FOO_EXPORTS = { "./foo": { types: "./foo/foo.d.ts", default: "./foo/foo.js" } };

describe("typecheckStore", () => {
    let dir: string | undefined;

    afterEach(() => {
        if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
        dir = undefined;
    });

    const run = (files: StoreSourceFile[]): void => {
        const storeDir = mkdtempSync(join(tmpdir(), "gtkx-typecheck-"));
        dir = storeDir;
        for (const file of files) {
            const filePath = join(storeDir, file.fileName);
            mkdirSync(dirname(filePath), { recursive: true });
            writeFileSync(filePath, file.source);
        }
        typecheckStore({ storeDir, files, packageName: "@gtkx/gi", exports: FOO_EXPORTS, resolveFrom: storeDir });
    };

    it("passes for well-typed modules that import each other through the store's own subpaths", () => {
        expect(() =>
            run([
                { fileName: "foo/foo.ts", source: "export const answer: number = 42;\n" },
                {
                    fileName: "bar/bar.ts",
                    source: 'import { answer } from "@gtkx/gi/foo";\nexport const ok: number = answer;\n',
                },
            ]),
        ).not.toThrow();
    });

    it("throws with a positioned message when a generated module has a type error", () => {
        expect(() =>
            run([
                { fileName: "foo/foo.ts", source: "export const answer: number = 42;\n" },
                {
                    fileName: "bar/bar.ts",
                    source: 'import { answer } from "@gtkx/gi/foo";\nexport const wrong: string = answer;\n',
                },
            ]),
        ).toThrow(/bar\/bar\.ts:2:\d+ - Type 'number' is not assignable to type 'string'/);
    });
});

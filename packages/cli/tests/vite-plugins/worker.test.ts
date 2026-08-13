import { writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gtkxWorker } from "../../src/vite-plugins/worker.js";
import { setupTempTree } from "../temp-tree.js";

type EmittedChunk = {
    type: string;
    id: string;
    fileName: string;
};

type ExtensionCase = {
    title: string;
    manifest: Record<string, string>;
    expected: string;
};

type TransformHook = (
    this: {
        resolve: (source: string, importer?: string) => Promise<{ id: string } | null>;
        emitFile: (chunk: EmittedChunk) => string;
    },
    code: string,
    id: string,
) => Promise<{ code: string; map: null } | null>;

type TransformRun = {
    code: string | null;
    emitted: EmittedChunk[];
};

type QuotedConstruction = {
    kind: string;
    source: string;
};

const MODULE_ID = "/project/src/app.tsx";
const MODULE_EMIT_DIR = fileURLToPath(new URL("../..", import.meta.url));
const CANONICAL_WORKER = 'const worker = new Worker(new URL("./worker.ts", import.meta.url));';
const WORKER_CHUNK = /^workers\/worker-[0-9a-f]{8}\.js$/;

const EXTENSION_CASES: ExtensionCase[] = [
    { title: "keeps .js when the package declares type module", manifest: { type: "module" }, expected: ".js" },
    { title: "emits .mjs when the package declares type commonjs", manifest: { type: "commonjs" }, expected: ".mjs" },
    { title: "emits .mjs when the package declares no type", manifest: { name: "typeless" }, expected: ".mjs" },
];

const QUOTED_CONSTRUCTIONS: QuotedConstruction[] = [
    { kind: "a string literal", source: "const doc = \"new Worker(new URL('./worker.ts', import.meta.url))\";" },
    { kind: "a template literal", source: "const doc = `new Worker(new URL('./worker.ts', import.meta.url))`;" },
    { kind: "a line comment", source: '// new Worker(new URL("./worker.ts", import.meta.url));' },
    { kind: "a block comment", source: '/* new Worker(new URL("./worker.ts", import.meta.url)); */' },
];

const runTransform = async (
    code: string,
    known: string[] = ["./worker.ts"],
    emitDir: string = MODULE_EMIT_DIR,
): Promise<TransformRun> => {
    const plugin = gtkxWorker(emitDir);
    const emitted: EmittedChunk[] = [];

    const result = await (plugin.transform as TransformHook).call(
        {
            resolve: (source) =>
                Promise.resolve(known.includes(source) ? { id: `/project/src/${source.slice(2)}` } : null),
            emitFile: (chunk) => {
                emitted.push(chunk);

                return "ref";
            },
        },
        code,
        MODULE_ID,
    );

    return { code: result?.code ?? null, emitted };
};

describe("gtkxWorker (plugin shape)", () => {
    it("returns a build-only plugin with the expected name", () => {
        const plugin = gtkxWorker(MODULE_EMIT_DIR);
        expect(plugin.name).toBe("gtkx:worker");
        expect(plugin.apply).toBe("build");
    });
});

describe("gtkxWorker (package module type)", () => {
    const project = setupTempTree("gtkx-worker-type-", "dist");

    it.each(EXTENSION_CASES)("$title", async ({ manifest, expected }) => {
        writeFileSync(join(project.path, "package.json"), JSON.stringify(manifest));
        const run = await runTransform(CANONICAL_WORKER, ["./worker.ts"], project.child);
        expect(extname(run.emitted[0]?.fileName ?? "")).toBe(expected);
    });
});

describe("gtkxWorker (inline worker URLs)", () => {
    it("emits a chunk and rewrites the URL for the canonical form", async () => {
        const run = await runTransform(CANONICAL_WORKER);
        const fileName = run.emitted[0]?.fileName ?? "";
        expect(run.emitted).toHaveLength(1);
        expect(run.emitted[0]?.id).toBe("/project/src/worker.ts");
        expect(fileName).toMatch(WORKER_CHUNK);
        expect(run.code).toBe(`const worker = new Worker(new URL("./${fileName}", import.meta.url));`);
    });

    it("emits a single chunk when the same worker is referenced twice", async () => {
        const source = [
            'const first = new Worker(new URL("./worker.ts", import.meta.url));',
            'const second = new Worker(new URL("./worker.ts", import.meta.url));',
        ].join("\n");

        const run = await runTransform(source);
        expect(run.emitted).toHaveLength(1);
        expect(run.code).not.toContain('"./worker.ts"');
    });

    it("leaves modules without a worker URL untouched", async () => {
        const run = await runTransform("export const answer = 42;");
        expect(run.code).toBeNull();
        expect(run.emitted).toEqual([]);
    });
});

describe("gtkxWorker (unresolvable specifiers)", () => {
    it("fails the build naming the file and the specifier", async () => {
        await expect(runTransform('new Worker(new URL("./missing.js", import.meta.url));', [])).rejects.toThrow(
            `${MODULE_ID}: the worker specifier "./missing.js" does not resolve to a module`,
        );
    });

    it("names the source file to write when only the extension is wrong", async () => {
        await expect(runTransform('new Worker(new URL("./worker.js", import.meta.url));')).rejects.toThrow(
            'Write new Worker(new URL("./worker.ts", import.meta.url)) instead.',
        );
    });

    it("asks for the path to be corrected when no sibling source exists", async () => {
        await expect(runTransform('new Worker(new URL("./missing.js", import.meta.url));', [])).rejects.toThrow(
            "Correct the path so it names the worker source file as it exists on disk.",
        );
    });
});

describe("gtkxWorker (hoisted worker URLs)", () => {
    it("fails the build naming the binding, the specifier and the inline form", async () => {
        const source = [
            'const WORKER_URL = new URL("./worker.ts", import.meta.url);',
            "const worker = new Worker(WORKER_URL);",
        ].join("\n");

        await expect(runTransform(source)).rejects.toThrow(
            `${MODULE_ID}: the worker URL for "./worker.ts" is bound to "WORKER_URL"`,
        );

        await expect(runTransform(source)).rejects.toThrow(
            'Write new Worker(new URL("./worker.ts", import.meta.url)) instead.',
        );
    });

    it("fails for an annotated declaration passed to a namespaced Worker constructor", async () => {
        const source = [
            'const url: URL = new URL("./worker.ts", import.meta.url);',
            'const worker = new node.Worker(url, { type: "module" });',
        ].join("\n");

        await expect(runTransform(source)).rejects.toThrow('bound to "url"');
    });

    it("ignores a hoisted URL that never reaches a Worker", async () => {
        const source = [
            'const DATA_URL = new URL("./data.json", import.meta.url);',
            'const worker = new Worker(new URL("./worker.ts", import.meta.url));',
        ].join("\n");

        const run = await runTransform(source);
        expect(run.emitted).toHaveLength(1);
        expect(run.code).toContain('new URL("./data.json", import.meta.url)');
    });
});

describe("gtkxWorker (strings and comments)", () => {
    it.each(QUOTED_CONSTRUCTIONS)("ignores a worker construction written inside $kind", async ({ source }) => {
        const run = await runTransform(source);
        expect(run.code).toBeNull();
        expect(run.emitted).toEqual([]);
    });

    it("ignores a hoisted worker URL written inside a block comment", async () => {
        const source = [
            "/*",
            ' const WORKER_URL = new URL("./worker.ts", import.meta.url);',
            " new Worker(WORKER_URL);",
            "*/",
            "export const answer = 42;",
        ].join("\n");

        const run = await runTransform(source);
        expect(run.code).toBeNull();
        expect(run.emitted).toEqual([]);
    });

    it("ignores a Worker construction quoted in a string when the URL is used for something else", async () => {
        const source = [
            'const WORKER_URL = new URL("./worker.ts", import.meta.url);',
            'console.log("new Worker(WORKER_URL)");',
            "console.log(WORKER_URL.href);",
        ].join("\n");

        const run = await runTransform(source);
        expect(run.code).toBeNull();
        expect(run.emitted).toEqual([]);
    });

    it("still rewrites a real worker URL in a module that also mentions one in a comment", async () => {
        const source = [
            '// new Worker(new URL("./old-worker.ts", import.meta.url));',
            'const worker = new Worker(new URL("./worker.ts", import.meta.url));',
        ].join("\n");

        const run = await runTransform(source);
        expect(run.emitted).toHaveLength(1);
        expect(run.code).toContain('// new Worker(new URL("./old-worker.ts", import.meta.url));');
    });
});

import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.characterarrays", libraries: ["HarfBuzz-0.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as GLib from "@gtkx/gi/glib";\nimport * as HarfBuzz from "@gtkx/gi/harfbuzz";\n';
const CONTROL = IMPORTS + 'export const found: boolean = GLib.strvContains(["one", "two"], "two");\n';
const ACCEPTED = IMPORTS + `export const read = (blob: HarfBuzz.blob_t): Uint8Array | null =>
    HarfBuzz.blobGetData(blob);
export const replace = (regex: GLib.Regex, bytes: Uint8Array): string => regex.replace(bytes, 0, "text", 0);
export const literal = (regex: GLib.Regex, bytes: number[]): string => regex.replaceLiteral(bytes, 0, "text", 0);
export const split = (regex: GLib.Regex, bytes: Uint8Array): string[] => regex.splitFull(bytes, 0, 0, 2);
export const glyph = (font: HarfBuzz.font_t, bytes: Uint8Array): number =>
    HarfBuzz.fontGetGlyphFromName(font, bytes)[0];
`;
const STRING_OUTPUT = IMPORTS + `export const read = (blob: HarfBuzz.blob_t): string[] | null =>
    HarfBuzz.blobGetData(blob);
`;
const STRING_INPUT = IMPORTS + `export const replace = (regex: GLib.Regex): string =>
    regex.replace(["text"], 0, "replacement", 0);
`;
const WRITABLE = IMPORTS + "export const writable = HarfBuzz.blobGetDataWritable;";
const CONSUMER = IMPORTS + String.raw`import assert from "node:assert/strict";
import { quit } from "@gtkx/runtime";

try {
    const binary = new Uint8Array([0, 255, 97, 128, 0]);
    const blob = HarfBuzz.glibBlobCreate(GLib.Bytes.new(binary));
    const copy = HarfBuzz.blobGetData(blob);
    assert(copy instanceof Uint8Array);
    assert.deepEqual(copy, binary);
    copy.fill(42);
    assert.deepEqual(HarfBuzz.blobGetData(blob), binary);
    const empty = HarfBuzz.blobGetData(HarfBuzz.blobGetEmpty());
    assert(empty === null || empty instanceof Uint8Array);
    assert.equal(empty?.byteLength ?? 0, 0);
    assert.equal("blobGetDataWritable" in HarfBuzz, false);
    assert.equal(GLib.strvContains(["é", "尾"], "尾"), true);

    const encoder = new TextEncoder();
    const regex = GLib.Regex.new("(é+)", 0, 0);
    assert(regex !== null);
    const subject = encoder.encode("éé / é");
    assert.equal(regex.replace(subject, 0, "<\\1>", 0), "<éé> / <é>");
    assert.equal(regex.replaceLiteral([...subject], 0, "<\\1>", 0), "<\\1> / <\\1>");
    assert.throws(() => regex.replace(subject, 1, "x", 0));
    assert.throws(() => regex.replaceLiteral(subject, 1, "x", 0));
    assert.equal(regex.replace(subject, 0, "x", 0), "x / x");
    assert.equal(regex.matchFull(subject, 0, 0)[1].fetch(0), "éé");
    assert.equal(regex.matchAllFull([...subject], 0, 0)[1].fetch(0), "éé");
    assert.equal(regex.replaceEval(subject, 0, 0, (info, result) => {
        const text = info.fetch(0);
        assert(text !== null);
        result.append(text.toUpperCase());
        return false;
    }), "ÉÉ / É");

    const separator = GLib.Regex.new(",", 0, 0);
    assert(separator !== null);
    const separated = encoder.encode("é,尾,z");
    assert.deepEqual(separator.splitFull(separated, 0, 0, 2), ["é", "尾,z"]);
    assert.deepEqual(separator.splitFull([...separated], 3, 0, 0), ["尾", "z"]);
    assert.throws(() => separator.splitFull(separated, 1, 0, 0));
    assert.deepEqual(separator.splitFull(separated, 0, 0, 0), ["é", "尾", "z"]);
    const backing = new Uint8Array([42]);
    for (const emptySubject of [[], new Uint8Array(), backing.subarray(1)]) {
        assert.equal(regex.replace(emptySubject, 0, "x", 0), "");
        assert.equal(regex.replaceLiteral(emptySubject, 0, "x", 0), "");
        assert.deepEqual(separator.splitFull(emptySubject, 0, 0, 0), []);
    }
    assert.deepEqual(backing, new Uint8Array([42]));
} finally {
    quit();
}
`;

describe("generated character arrays", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-character-array-types-",
            config: CONFIG,
            files: {
                "accepted.ts": ACCEPTED,
                "control.ts": CONTROL,
                "strings.ts": STRING_OUTPUT,
                "input.ts": STRING_INPUT,
                "writable.ts": WRITABLE,
                "probe.ts": CONSUMER,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves arrays of string pointers", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it("accepts byte arrays for contiguous character data", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(["strings.ts", "input.ts", "writable.ts"])("rejects unsupported contract %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents copied bytes and omits writable native aliases", () => {
        const reference = loadApiReference({
            libraries: ["HarfBuzz-0.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("HarfBuzz.blobGetData", "function");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining("Uint8Array | null"));
        expect(reference.lookup("HarfBuzz.blobGetDataWritable", "function").outcome).toBe("notFound");
    });

    it("copies binary blobs and processes UTF-8 byte inputs", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-character-array-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

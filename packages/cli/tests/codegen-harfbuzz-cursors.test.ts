import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.harfbuzzcursors", libraries: ["HarfBuzz-0.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as HarfBuzz from "@gtkx/gi/harfbuzz";\n';
const CONSUMER = IMPORTS + `import assert from "node:assert/strict";
import { quit } from "@gtkx/runtime";

const encoder = new TextEncoder();
const format = HarfBuzz.buffer_serialize_format_t.TEXT;
type Deserialize = (buffer: HarfBuzz.buffer_t, source: Uint8Array | number[]) => [number, Uint8Array];
const unicode: Deserialize = (buffer, source) => HarfBuzz.bufferDeserializeUnicode(buffer, source, format);
const glyphs: Deserialize = (buffer, source) => HarfBuzz.bufferDeserializeGlyphs(buffer, source, null, format);
type Example = { text: string; status: number; tail: string; codepoints: number[]; clusters: number[] };

const unicodeExamples: Example[] = [
    { text: "<U+0041=0|U+00E9=1>", status: 1, tail: "", codepoints: [65, 233], clusters: [0, 1] },
    { text: "<U+0041=0|U+0042=1|!", status: 0, tail: "!", codepoints: [65], clusters: [0] },
    { text: "!", status: 0, tail: "!", codepoints: [], clusters: [] },
    { text: "", status: 0, tail: "", codepoints: [], clusters: [] },
];
const glyphExamples: Example[] = [
    { text: "[gid12=3+40|gid7=8@1,-2+9,10]", status: 1, tail: "", codepoints: [12, 7], clusters: [3, 8] },
    { text: "[gid12=3+40|?]", status: 0, tail: "?]", codepoints: [12], clusters: [3] },
    { text: "[?]", status: 0, tail: "[?]", codepoints: [], clusters: [] },
    { text: "", status: 0, tail: "", codepoints: [], clusters: [] },
];

const verify = (deserialize: Deserialize, example: Example, asNumbers: boolean): void => {
    const buffer = HarfBuzz.bufferCreate();
    const bytes = encoder.encode(example.text);
    const input = asNumbers ? [...bytes] : bytes;
    const [status, tail] = deserialize(buffer, input);
    assert.equal(status, example.status);
    assert.ok(tail instanceof Uint8Array);
    assert.deepEqual([...tail], [...encoder.encode(example.tail)]);
    assert.equal(HarfBuzz.bufferGetLength(buffer), example.codepoints.length);
    const infos = HarfBuzz.bufferGetGlyphInfos(buffer);
    assert.deepEqual(infos.map((info) => info.codepoint), example.codepoints);
    assert.deepEqual(infos.map((info) => info.cluster), example.clusters);
    input.fill(0);
    assert.deepEqual([...tail], [...encoder.encode(example.tail)]);
};

try {
    for (const example of unicodeExamples) {
        verify(unicode, example, false);
    }
    for (const example of glyphExamples) {
        verify(glyphs, example, true);
    }
    const recovery = HarfBuzz.bufferCreate();
    assert.equal(unicode(recovery, encoder.encode("!"))[0], 0);
    assert.equal(unicode(recovery, encoder.encode("<U+0042=2>"))[0], 1);
    assert.deepEqual(HarfBuzz.bufferGetGlyphInfos(recovery).map((info) => info.codepoint), [66]);
} finally {
    quit();
}
`;
const CONTROL = IMPORTS + `export const unicodeStatus = (
    buffer: HarfBuzz.buffer_t, source: Parameters<typeof HarfBuzz.bufferDeserializeUnicode>[1],
): number => HarfBuzz.bufferDeserializeUnicode(buffer, source, HarfBuzz.buffer_serialize_format_t.TEXT)[0];
export const glyphStatus = (
    buffer: HarfBuzz.buffer_t, source: Parameters<typeof HarfBuzz.bufferDeserializeGlyphs>[1],
): number => HarfBuzz.bufferDeserializeGlyphs(buffer, source, null, HarfBuzz.buffer_serialize_format_t.TEXT)[0];
`;
const REJECTED = {
    "unicode-string-tail.ts": IMPORTS + `export const tail = (
    buffer: HarfBuzz.buffer_t, source: Parameters<typeof HarfBuzz.bufferDeserializeUnicode>[1],
): string => HarfBuzz.bufferDeserializeUnicode(buffer, source, HarfBuzz.buffer_serialize_format_t.TEXT)[1];`,
    "glyph-string-tail.ts": IMPORTS + `export const tail = (
    buffer: HarfBuzz.buffer_t, source: Parameters<typeof HarfBuzz.bufferDeserializeGlyphs>[1],
): string => HarfBuzz.bufferDeserializeGlyphs(buffer, source, null, HarfBuzz.buffer_serialize_format_t.TEXT)[1];`,
};

describe("generated HarfBuzz deserializer cursors", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-harfbuzz-cursor-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, "control.ts": CONTROL, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts byte inputs and bounded byte results", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("preserves independent scalar status readers", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects string cursor assumptions in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents byte inputs and remaining byte results", () => {
        const reference = loadApiReference({
            libraries: ["HarfBuzz-0.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        for (const name of ["bufferDeserializeUnicode", "bufferDeserializeGlyphs"]) {
            const page = reference.lookup(`HarfBuzz.${name}`, "function");
            expect(page.outcome).toBe("page");
            expect(page).toHaveProperty("markdown", expect.stringContaining("buf: Uint8Array | number[]"));
            expect(page).toHaveProperty("markdown", expect.stringContaining("[HarfBuzz.bool_t, Uint8Array]"));
        }
    });

    it("deserializes owned buffers and returns independent remaining bytes", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-harfbuzz-cursor-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.pangolifetime", libraries: ["Pango-1.0"],' +
    " agents: { reference: false, rules: false } };";
const CONSUMER = `import assert from "node:assert/strict";
import * as Pango from "@gtkx/gi/pango";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("destroy" in Pango.Attribute.prototype, false);
    assert.equal("destroy" in Pango.AttrIterator.prototype, false);
    const attribute = Pango.AttrSize.new(12 * Pango.SCALE);
    assert.equal(attribute.startIndex, Pango.ATTR_INDEX_FROM_TEXT_BEGINNING);
    attribute.startIndex = 2;
    attribute.endIndex = 7;
    const copied = attribute.copy();
    assert.equal(copied.equal(attribute), true);
    assert.equal(copied.startIndex, 2);
    assert.equal(copied.endIndex, 7);

    const list = Pango.AttrList.new();
    const iterator = list.getIterator();
    const duplicate = iterator.copy();
    assert.deepEqual(duplicate.range(), iterator.range());
    assert.deepEqual(iterator.getAttrs(), []);
    assert.equal(iterator.next(), false);
    assert.equal(duplicate.next(), false);
} finally {
    quit();
}
`;
const REJECTED: Record<string, string> = {
    "attribute-call.ts": 'import * as Pango from "@gtkx/gi/pango";' +
        " export const destroy = (value: Pango.Attribute) => value.destroy();",
    "attribute-member.ts": 'import * as Pango from "@gtkx/gi/pango";' +
        ' export type Destroy = Pango.Attribute["destroy"];',
    "iterator-call.ts": 'import * as Pango from "@gtkx/gi/pango";' +
        " export const destroy = (value: Pango.AttrIterator) => value.destroy();",
    "iterator-member.ts": 'import * as Pango from "@gtkx/gi/pango";' +
        ' export type Destroy = Pango.AttrIterator["destroy"];',
};

describe("generated Pango lifetime contracts", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-pango-lifetime-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts owned attributes and iterators through their non-consuming APIs", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the manual destructor in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents only generated Pango members", () => {
        const reference = loadApiReference({
            libraries: ["Pango-1.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const attribute = reference.lookup("Pango.Attribute", "record");
        expect(attribute.outcome).toBe("page");
        expect(attribute).toHaveProperty("markdown", expect.stringContaining("### `copy`"));
        expect(attribute).toHaveProperty("markdown", expect.stringContaining("### `equal`"));
        expect(attribute).toHaveProperty("markdown", expect.not.stringContaining("### `destroy`"));
        const iterator = reference.lookup("Pango.AttrIterator", "record");
        expect(iterator.outcome).toBe("page");
        expect(iterator).toHaveProperty("markdown", expect.stringContaining("### `range`"));
        expect(iterator).toHaveProperty("markdown", expect.not.stringContaining("### `destroy`"));

        for (const name of ["attrFontDescNew", "attrListFromString", "fontDescriptionFromString"]) {
            expect(reference.lookup(`Pango.${name}`, "function").outcome).toBe("notFound");
        }

        const fontAttribute = reference.lookup("Pango.AttrFontDesc", "record");
        expect(fontAttribute).toHaveProperty("markdown", expect.stringContaining("### `new`"));
        const list = reference.lookup("Pango.AttrList", "record");
        expect(list).toHaveProperty("markdown", expect.stringContaining("### `fromString`"));
        const description = reference.lookup("Pango.FontDescription", "record");
        expect(description).toHaveProperty("markdown", expect.stringContaining("### `fromString`"));
    });

    it("uses owned attributes and iterators without exposing their destructors", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-pango-lifetime-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.hiddenstringmutators", libraries: ["GLib-2.0"],' +
    " agents: { reference: false, rules: false } };";
const CONSUMER = `import assert from "node:assert/strict";
import * as GLib from "@gtkx/gi/glib";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("strlcpy" in GLib, false);
    assert.equal("strlcat" in GLib, false);
    const original = "Héllo GTKX";
    const copied: string = GLib.strdup(original);
    assert.equal(copied, original);
    assert.equal(GLib.strdup(""), "");
    assert.equal(GLib.asciiStrdown("GTKX", -1), "gtkx");
    assert.equal(GLib.asciiStrdown("", -1), "");
    assert.equal(GLib.strHasPrefix(copied, "Héllo"), true);
    assert.equal(GLib.strHasPrefix(copied, "GTKX"), false);
    assert.equal(GLib.strHasPrefix("", ""), true);
    assert.throws(() => GLib.strdup(String.fromCharCode(0)));
} finally {
    quit();
}
`;
const REJECTED: Record<string, string> = {
    "copy-import.ts": 'import { strlcpy } from "@gtkx/gi/glib"; export const copy = strlcpy;',
    "copy-member.ts": 'import * as GLib from "@gtkx/gi/glib"; export type Copy = typeof GLib.strlcpy;',
    "append-import.ts": 'import { strlcat } from "@gtkx/gi/glib"; export const append = strlcat;',
    "append-member.ts": 'import * as GLib from "@gtkx/gi/glib"; export type Append = typeof GLib.strlcat;',
};

describe("generated string destination omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-hidden-string-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, ...REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts existing string-copying and read-only functions", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted function in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("keeps supported string functions in the public reference", () => {
        const reference = loadApiReference({
            libraries: ["GLib-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        expect(reference.lookup("GLib.strdup", "function").outcome).toBe("page");
        expect(reference.lookup("GLib.asciiStrdown", "function").outcome).toBe("page");
        expect(reference.lookup("GLib.strHasPrefix", "function").outcome).toBe("page");
        expect(reference.lookup("GLib.strlcpy", "function").outcome).toBe("notFound");
        expect(reference.lookup("GLib.strlcat", "function").outcome).toBe("notFound");
    });

    it("imports the public namespace and uses existing string functions", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-hidden-string-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

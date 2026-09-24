import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.gtypealiases",
    libraries: ["GTypeAliases-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const CONSUMER = `import assert from "node:assert/strict";
import * as GObject from "@gtkx/gi/gobject";
import * as GTypeAliases from "@gtkx/gi/gtypealiases";
import { quit } from "@gtkx/runtime";

try {
    const objectType = GObject.typeFromName("GObject");
    assert.notEqual(objectType, 0n);
    const fundamental = GTypeAliases.fundamental(objectType);
    assert.equal(typeof fundamental, "bigint");
    assert.equal(fundamental, objectType);
    assert.equal(GTypeAliases.name(fundamental), "GObject");
    assert.equal(GTypeAliases.name(0n), null);
    assert.throws(() => GTypeAliases.fundamental("invalid"));
    assert.throws(() => GTypeAliases.name("invalid"));
    assert.equal(GTypeAliases.name(objectType), "GObject");
} finally {
    quit();
}
`;

describe("generated GType alias values", () => {
    it("uses direct and chained aliases with real GObject type functions", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-gtype-alias-values-",
            config: CONFIG,
            files: {
                "gir/GTypeAliases-1.0.gir": readFileSync(new URL("fixtures/gir/GTypeAliases-1.0.gir", import.meta.url)),
                "probe.mjs": CONSUMER,
            },
        });
        runCliOrThrow(project, ["codegen"]);
        expect(() => {
            runNativeConsumer(project, "probe.mjs");
        }).not.toThrow();
    });
});

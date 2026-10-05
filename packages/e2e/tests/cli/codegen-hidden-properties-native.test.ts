import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./type-consumer.js";

const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as Gio from "@gtkx/gi/gio";
import { quit } from "@gtkx/runtime";

try {
    for (const name of ["data", "destroyFunction", "reallocFunction"]) {
        assert.equal(name in Gio.MemoryOutputStream.prototype, false);
    }
    assert.equal("dataSize" in Gio.MemoryOutputStream.prototype, true);
    const stream = Gio.MemoryOutputStream.newResizable();
    const values = new Uint8Array([0, 255, 3]);
    assert.deepEqual(stream.writeAll(values, null), [true, values.length]);
    assert.equal(stream.dataSize, 3n);
    assert.equal(stream.getDataSize(), 3);
    assert.equal(stream.close(null), true);
    assert.deepEqual(stream.stealAsBytes().getData(), values);
} finally {
    quit();
}
`;

describe("generated raw-pointer native property omissions", () => {
    it("preserves supported operations without exposing the native data property", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-hidden-property-values-",
            config: 'export default { applicationId: "org.gtkx.hiddenpropertyvalues", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

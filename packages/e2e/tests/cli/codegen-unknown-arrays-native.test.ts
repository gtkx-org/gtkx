import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { NATIVE_CONSUMER } from "./codegen-unknown-arrays-fixture.js";
import { runNativeConsumer } from "./type-consumer.js";

describe("generated unknown-length array omissions", () => {
    it("uses supported native alternatives and the sized Pixbuf shadow", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-known-array-values-",
            config: 'export default { applicationId: "org.gtkx.knownarrayvalues", libraries: ["GdkPixbuf-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { SCALAR_POINTER_NATIVE_CONSUMER } from "./codegen-scalar-pointers-fixture.js";
import { runNativeConsumer } from "./type-consumer.js";

describe("generated scalar C pointer omissions", () => {
    it("uses supported HMAC byte APIs and corrected Unicode arrays", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-scalar-pointer-values-",
            config: 'export default { applicationId: "org.gtkx.scalarpointervalues", libraries: ["GdkPixbuf-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": SCALAR_POINTER_NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

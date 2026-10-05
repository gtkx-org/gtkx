import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { NATIVE_CONSUMER } from "./codegen-hidden-callables-fixture.js";
import { runNativeConsumer } from "./type-consumer.js";

describe("generated raw-pointer callable omissions", () => {
    it("imports the remaining public exports and exercises safe boxed values and comparators", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-hidden-callable-values-",
            config: 'export default { applicationId: "org.gtkx.hiddencallablevalues", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});

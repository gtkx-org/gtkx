import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { NATIVE_CONSUMER } from "./codegen-caller-containers-fixture.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

describe("generated caller-allocated native containers", () => {
    it("preserves native Icon serialization and the later supported vfunc slot", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-icon-serialization-",
            config: 'export default { applicationId: "org.gtkx.iconserialization", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
        isolateTypeConsumer(consumer);
        expect(typecheckFile(consumer, "probe.ts")).toBe(0);
    });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BINDING_CONSUMERS } from "./codegen-binding-consumers.js";
import { createBindingConsumerHarness } from "./codegen-bindings-consumer-fixture.js";

describe.each(BINDING_CONSUMERS.filter(({ library }) => library === "RecordFields-1.0"))(
    "gtkx codegen ($title)",
    (consumer) => {
        const harness = createBindingConsumerHarness(consumer);
        beforeAll(harness.setup);
        afterAll(harness.cleanup);

        it.each(harness.accepted)("accepts the public consumer in %s", (file) => {
            expect(harness.status()).toBe(0);
            expect(harness.typecheck(file)).toBe(0);
        });

        it.each(harness.rejected)("rejects the incompatible consumer in %s", (file) => {
            expect(harness.status()).toBe(0);
            expect(harness.typecheck(file)).not.toBe(0);
        });
    },
);

import { describe, it } from "vitest";
import { VALUE_MARSHALLING_CONSUMERS } from "./codegen-marshalling-consumers.js";
import { expectMarshallingConsumer } from "./codegen-marshalling-suite.js";

describe("gtkx codegen marshalling", () => {
    it.each(VALUE_MARSHALLING_CONSUMERS)("$title", (consumer) => {
        expectMarshallingConsumer(consumer);
    });
});

import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";
import { runNativeConsumer } from "./type-consumer.js";

const RUNTIME_SOURCE = new URL("../../runtime/src/index.ts", import.meta.url).href;
const CONSUMER = `import assert from "node:assert/strict";
import * as GObject from "@gtkx/gi/gobject";
import { getHandle } from "@gtkx/runtime";
import { getHandle as getSourceHandle } from ${JSON.stringify(RUNTIME_SOURCE)};

const object = new GObject.Object();
assert.equal(getSourceHandle(object), getHandle(object));
`;

describe("workspace runtime resolution", () => {
    it("shares native object handles with generated bindings from a temporary project", () => {
        using project = createCliProject({
            prefix: "gtkx-source-runtime-",
            hasStore: true,
            shouldShareStore: true,
            files: { "probe.ts": CONSUMER },
        });

        expect(() => {
            runNativeConsumer(project);
        }).not.toThrow();
    });
});

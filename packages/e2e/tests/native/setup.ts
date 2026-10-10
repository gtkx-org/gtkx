import { t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { afterEach, inject } from "vitest";
import type {} from "./context.d.ts";
import { drainGC } from "./helpers/memory.js";
import "./helpers/coverage.js";

const { asanRuntime } = inject("nativeTest");
const checkLeaks = t.bind(asanRuntime, "__lsan_do_recoverable_leak_check", [], t.int32);

afterEach(async () => {
    await drainGC();
    assert.equal(checkLeaks(), 0, "LeakSanitizer found unreleased native allocations after this test");
});

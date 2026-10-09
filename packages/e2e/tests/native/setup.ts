import { t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { afterEach } from "vitest";
import { drainGC } from "./helpers/memory.js";
import "./helpers/coverage.js";

const runtime = process.env.GTKX_ASAN_RUNTIME;

if (runtime === undefined) {
    throw new Error("Native E2E tests require the instrumented addon and LeakSanitizer");
}

const checkLeaks = t.bind(runtime, "__lsan_do_recoverable_leak_check", [], t.int32);

afterEach(async () => {
    await drainGC();
    assert.equal(checkLeaks(), 0, "LeakSanitizer found unreleased native allocations after this test");
});

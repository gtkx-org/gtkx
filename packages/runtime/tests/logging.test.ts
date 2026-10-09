import { onLog, t, type LogLevel } from "@gtkx/runtime";
import { expect, test } from "vitest";

const log = t.bind(
    "libglib-2.0.so.0",
    "g_log_structured_standard",
    [t.string(), t.uint32, t.string(), t.string(), t.string(), t.string()],
    t.void,
);

test("runtime log subscriptions receive diagnostics and stop receiving them after removal", async () => {
    const records: { level: LogLevel; domain: string; message: string }[] = [];
    let removedCalls = 0;
    const removed = onLog(() => {
        removedCalls += 1;
    });
    const retained = onLog((level, domain, message) => {
        records.push({ level, domain, message });
    });
    removed.unsubscribe();
    removed.unsubscribe();

    try {
        log("gtkx-runtime-test", 16, "runtime.test.ts", "1", "logging", "runtime diagnostic");
        await expect.poll(() => records.length).toBe(1);
        expect(records).toEqual([{ level: "warning", domain: "gtkx-runtime-test", message: "runtime diagnostic" }]);
        expect(removedCalls).toBe(0);
    } finally {
        retained.unsubscribe();
    }
});

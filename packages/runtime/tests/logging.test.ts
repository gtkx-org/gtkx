import { onLog, t, type LogLevel } from "@gtkx/runtime";
import { resolveExecutable } from "@gtkx/utils";
import { execFile, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/logging.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
const directory = mkdtempSync(join(tmpdir(), "gtkx-logging-"));
const library = join(directory, "libgtkx-logging.so");
execFileSync(resolveExecutable("gcc"), [
    "-shared",
    "-fPIC",
    "-Wall",
    "-Wextra",
    "-Werror",
    join(import.meta.dirname, "fixtures/logging.c"),
    "-o",
    library,
    "-lglib-2.0",
    "-lpthread",
]);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const log = t.bind(
    "libglib-2.0.so.0",
    "g_log_structured_standard",
    [t.string(), t.uint32, t.string(), t.string(), t.string(), t.string()],
    t.void,
);
const emit = (message: string, level = 64): void => {
    log("gtkx-runtime-test", level, "runtime.test.ts", "1", "logging", message);
};

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
        emit("runtime diagnostic", 16);
        await expect.poll(() => records.length).toBe(1);
        expect(records).toEqual([{ level: "warning", domain: "gtkx-runtime-test", message: "runtime diagnostic" }]);
        expect(removedCalls).toBe(0);
    } finally {
        retained.unsubscribe();
    }
});

test("subscription intervals preserve queued records across subscribe and unsubscribe", async () => {
    const before: string[] = [];
    const after: string[] = [];
    const first = onLog((_level, _domain, message) => before.push(message));
    emit("before subscribing");
    const second = onLog((_level, _domain, message) => after.push(message));
    emit("before unsubscribing");
    first.unsubscribe();
    emit("after unsubscribing");
    second.unsubscribe();
    await expect.poll(() => after.length).toBe(2);
    expect(before).toEqual(["before subscribing", "before unsubscribing"]);
    expect(after).toEqual(["before unsubscribing", "after unsubscribing"]);
});

test("reentrant subscription changes retain the emission-time audience", async () => {
    const received: string[] = [];
    let reentrant = { unsubscribe: (): void => {} };
    const first = onLog((_level, _domain, message) => {
        received.push(`first:${message}`);
        if (message === "one") {
            second.unsubscribe();
            reentrant = onLog((_nextLevel, _nextDomain, next) => received.push(`new:${next}`));
            emit("three");
        }
    });
    const second = onLog((_level, _domain, message) => received.push(`second:${message}`));
    try {
        emit("one");
        emit("two");
        await expect.poll(() => received.length).toBe(6);
        expect(received).toEqual(["first:one", "second:one", "first:two", "second:two", "first:three", "new:three"]);
    } finally {
        first.unsubscribe();
        second.unsubscribe();
        reentrant.unsubscribe();
    }
});

test("multiple producer threads preserve every record and each producer's order", async () => {
    const messages: string[] = [];
    const subscription = onLog((_level, domain, message) => {
        if (domain === "gtkx-threaded-test") {
            messages.push(message);
        }
    });
    const produce = t.bind(library, "gtkx_log_threads", [t.uint32], t.void);
    produce(25);
    subscription.unsubscribe();
    await expect.poll(() => messages.length).toBe(100);
    for (let producer = 0; producer < 4; producer += 1) {
        expect(messages.filter((message) => message.startsWith(`${String(producer)}:`))).toEqual(
            Array.from({ length: 25 }, (_, index) => `${String(producer)}:${String(index)}`),
        );
    }
});

test("the final unsubscribe fence releases callbacks even when logging stops", async () => {
    const gc = globalThis.gc;
    if (gc === undefined) {
        throw new Error("Logging lifetime tests require --expose-gc");
    }
    const register = (): { weak: WeakRef<() => void>; subscription: { unsubscribe(): void } } => {
        const listener = (): void => {};
        const subscription = onLog(listener);
        subscription.unsubscribe();
        return { weak: new WeakRef(listener), subscription };
    };
    const { weak, subscription } = register();
    await expect
        .poll(async () => {
            await new Promise<void>((resolve) => setImmediate(resolve));
            gc();
            return weak.deref();
        })
        .toBeUndefined();
    subscription.unsubscribe();
});

test("nested synchronous critical traps preserve both diagnostics and call errors", async () => {
    const records: string[] = [];
    const subscription = onLog((_level, _domain, message) => records.push(message));
    const nested = t.bind(library, "gtkx_log_nested", [t.callback([], t.void, { scope: "call" })], t.void);
    try {
        expect(() => nested(() => expect(() => emit("inner critical", 8)).toThrow("inner critical"))).toThrow(
            "outer critical",
        );
        subscription.unsubscribe();
        await expect.poll(() => records.length).toBe(2);
        expect(records).toEqual(["outer critical", "inner critical"]);
    } finally {
        subscription.unsubscribe();
    }
});

test("handled listener exceptions leave other subscriptions and queued records deliverable", async () => {
    const result = await run(process.execPath, ["--import", loader, fixture, "throw"], { timeout: 10_000 });
    expect(JSON.parse(result.stdout)).toEqual({
        thrown: ["first record", "second record"],
        records: ["first record", "second record"],
        sameErrors: [true, true],
    });
});

test("log listener failures are aggregated after fanout without interrupting later records", async () => {
    const result = await run(process.execPath, ["--import", loader, fixture, "throw-multiple"], { timeout: 10_000 });
    expect(JSON.parse(result.stdout)).toEqual({
        thrown: [
            { aggregate: true, sameErrors: true },
            { aggregate: true, sameErrors: true },
        ],
        records: ["middle:first record", "last:first record", "middle:second record", "last:second record"],
    });
});

test("terminating a logging worker releases its sink before another environment subscribes", async () => {
    const result = await run(process.execPath, ["--import", loader, fixture, "workers"], { timeout: 10_000 });
    expect(JSON.parse(result.stdout)).toEqual(["worker record", "worker record"]);
});

test.each([
    ["fatal", "fatal diagnostic"],
    ["unhandled", "uncaught log listener"],
])("%s logging retains process-level diagnostics", async (mode, diagnostic) => {
    const child = spawn(process.execPath, ["--import", loader, fixture, mode], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
        killSignal: "SIGKILL",
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
    });
    const exits =
        mode === "fatal"
            ? [
                  { code: null, signal: "SIGABRT" },
                  { code: null, signal: "SIGTRAP" },
              ]
            : [{ code: 1, signal: null }];
    expect(exits).toContainEqual(result);
    expect(output).toContain(diagnostic);
    expect(output).not.toContain("FATAL LISTENER RAN");
});

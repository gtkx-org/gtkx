import type { Descriptor } from "@gtkx/native";
import { bind, call, resolveType } from "@gtkx/native";
import { spawn } from "node:child_process";
import { expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";
import { drainAfterEachTest } from "./helpers/memory.js";

type FixtureRun = {
    code: number | null;
    elapsed: number;
    output: string;
    signal: NodeJS.Signals | null;
};

type WorkerReport = { bare: boolean; doubled: number; string: string };

const OBSERVED_PREFIX = "OBSERVED ";
const CHILD_BUDGET_MS = 30_000;
const GLIB = "libglib-2.0.so.0";
const VOID: Descriptor = { kind: "void" };
const INT32: Descriptor = { kind: "int32" };
const UINT32: Descriptor = { kind: "uint32" };
const BUFFER: Descriptor = { kind: "buffer" };
const STRING_FULL: Descriptor = { kind: "string", ownership: "full" };
const NESTING_LIMIT = 80;
const WORKER_REPORT: WorkerReport = { bare: true, doubled: 42, string: "worker" };

drainAfterEachTest();

const childEnvironment = (): NodeJS.ProcessEnv => {
    const environment = childEnv();
    delete environment.G_DEBUG;

    return environment;
};

const runFixture = (name: string, args: string[] = []): Promise<FixtureRun> =>
    new Promise((resolve) => {
        const child = spawn(process.execPath, [...fixtureArgs(name), ...args], {
            env: childEnvironment(),
            stdio: ["ignore", "pipe", "pipe"],
        });

        const started = Date.now();
        const chunks: Buffer[] = [];
        const budget = setTimeout(() => {
            child.kill("SIGKILL");
        }, CHILD_BUDGET_MS);

        child.stdout.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });

        child.stderr.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });

        child.once("close", (code, signal) => {
            clearTimeout(budget);
            resolve({
                code,
                elapsed: Date.now() - started,
                output: Buffer.concat(chunks).toString("utf8"),
                signal,
            });
        });
    });

const runFailingFixture = async (name: string, args: string[] = []): Promise<void> => {
    const result = await runFixture(name, args);

    if (result.code !== 0 || result.signal !== null) {
        throw new Error(result.output);
    }
};

const reportedLine = (output: string, prefix: string): string | undefined =>
    output
        .split("\n")
        .find((line) => line.startsWith(prefix))
        ?.slice(prefix.length);

const observedMessage = (output: string): string | undefined => reportedLine(output, OBSERVED_PREFIX);

const workerReport = (output: string): WorkerReport =>
    JSON.parse(reportedLine(output, "REPORT ") ?? "null") as WorkerReport;

test("benign native work never reaches the app as an error", async () => {
    const { code, output, signal } = await runFixture("error-channel.ts", ["none", "observed"]);

    expect(observedMessage(output)).toBeUndefined();
    expect(output).toMatch(/SURVIVED/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a GLib critical reaches the app as an uncaught exception", async () => {
    const { code, output, signal } = await runFixture("error-channel.ts", ["critical", "observed"]);

    const observed = observedMessage(output);
    expect(typeof observed).toBe("string");
    expect(observed?.length).toBeGreaterThan(0);
    expect(output).not.toMatch(/SURVIVED/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a native panic reaches the app as an uncaught exception", async () => {
    const { code, output, signal } = await runFixture("error-channel.ts", ["panic", "observed"]);

    const observed = observedMessage(output);
    expect(typeof observed).toBe("string");
    expect(observed?.length).toBeGreaterThan(0);
    expect(output).not.toMatch(/SURVIVED/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("an unhandled GLib critical stops the process", async () => {
    const { code, output } = await runFixture("error-channel.ts", ["critical", "ignored"]);

    expect(code).not.toBe(0);
    expect(output).not.toMatch(/SURVIVED/);
});

test("an unhandled native panic stops the process", async () => {
    const { code, output } = await runFixture("error-channel.ts", ["panic", "ignored"]);

    expect(code).not.toBe(0);
    expect(output).not.toMatch(/SURVIVED/);
});

test("quit tears the run loop down and lets the process exit", async () => {
    const { code, output, signal } = await runFixture("quit.ts");

    expect(output).toMatch(/OBJECT built/);
    expect(output).toMatch(/QUIT/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("the process exits on its own when only unref'd GLib sources remain", async () => {
    const { code, elapsed, output, signal } = await runFixture("idle-exit.ts");

    expect(output).toMatch(/SOURCES/);
    expect(output).toMatch(/EXITED/);
    expect(elapsed).toBeLessThan(CHILD_BUDGET_MS / 2);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a fresh process registers GStrv before its first string-array value", async () => {
    const { code, output, signal } = await runFixture("strv-first-use.ts");

    expect(output).toMatch(/STRV READY/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("GioUnix search returns nested string arrays", async () => {
    const { code, output, signal } = await runFixture("gio-unix-search.ts");

    expect(output).toMatch(/NESTED STRINGS/);
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("the addon drives real bindings inside a worker thread that finishes on its own", async () => {
    const { code, output, signal } = await runFixture("worker-host.ts", ["graceful"]);

    expect(workerReport(output)).toEqual(WORKER_REPORT);
    expect(reportedLine(output, "EXITED ")).toBe("0");
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a worker thread that quits the addon can then be terminated", async () => {
    const { code, output, signal } = await runFixture("worker-host.ts", ["terminate"]);

    expect(workerReport(output)).toEqual(WORKER_REPORT);
    expect(reportedLine(output, "ACK ")).toBe("torn down");
    expect(reportedLine(output, "TERMINATED ")).toBe("1");
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a worker thread that never quits the addon can still be terminated", async () => {
    const { code, output, signal } = await runFixture("worker-host.ts", ["kill"]);

    expect(workerReport(output)).toEqual(WORKER_REPORT);
    expect(reportedLine(output, "TERMINATED ")).toBe("1");
    expect(signal).toBeNull();
    expect(code).toBe(0);
});

test("a worker cannot acquire GTKX after the main thread", async () => {
    await expect(runFailingFixture("worker-host.ts", ["conflict"])).rejects.toThrow();
});

test("a library or symbol that is not there fails the call it backs", () => {
    const missingLibrary = bind("libgtkx-not-a-real-library.so.0", "g_free", [], VOID);
    const missingSymbol = bind("libgobject-2.0.so.0", "g_object_not_a_real_symbol", [], VOID);

    expect(() => resolveType("libgtkx-not-a-real-library.so.0", "gtk_widget_get_type")).toThrow();
    expect(() => call(missingLibrary, [])).toThrow();
    expect(() => call(missingSymbol, [])).toThrow();
    expect(resolveType("libgobject-2.0.so.0", "g_not_a_real_type_get_type")).toBe(0n);
});

test("a malformed descriptor is refused when the call is bound", () => {
    let nested: Descriptor = INT32;

    for (let level = 0; level < NESTING_LIMIT; level += 1) {
        nested = { kind: "ref", innerDescriptor: nested };
    }

    const fixedArray: Descriptor = {
        kind: "array",
        itemDescriptor: INT32,
        arrayKind: "fixed",
        ownership: "borrowed",
    };

    const sizedArray: Descriptor = {
        kind: "array",
        itemDescriptor: INT32,
        arrayKind: "sized",
        ownership: "borrowed",
    };

    expect(() => bind(GLIB, "g_free", [nested], VOID)).toThrow();
    expect(() => bind(GLIB, "g_free", [{ kind: "string", ownership: "borrowed", length: -5 }], VOID)).toThrow();
    expect(() => bind(GLIB, "g_free", [fixedArray], VOID)).toThrow();
    expect(() => bind(GLIB, "g_free", [sizedArray], VOID)).toThrow();
    // @ts-expect-error a kind no descriptor variant carries
    expect(() => bind(GLIB, "g_free", [{ kind: "gtkx-not-a-kind" }], VOID)).toThrow();
});

test("a buffer descriptor hands a typed array to C as a raw pointer", () => {
    const checksum = bind(GLIB, "g_compute_checksum_for_data", [INT32, BUFFER, UINT32], STRING_FULL);
    expect(call(checksum, [0, new Uint8Array([97, 98, 99]), 3])).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(call(checksum, [0, new TextEncoder().encode("abc"), 3])).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(call(checksum, [0, null, 0])).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(call(checksum, [0, 0, 0])).toBe("d41d8cd98f00b204e9800998ecf8427e");
});

test("a buffer descriptor rejects values that are not a view, an address or null", () => {
    const checksum = bind(GLIB, "g_compute_checksum_for_data", [INT32, BUFFER, UINT32], STRING_FULL);
    expect(() => call(checksum, [0, "abc", 3])).toThrow();
    expect(() => call(checksum, [0, 1.5, 0])).toThrow();
    expect(() => call(checksum, [0, -1, 0])).toThrow();
    expect(() => call(checksum, [0, {}, 0])).toThrow();
});

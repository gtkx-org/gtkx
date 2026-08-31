import { bind, call, resolveType } from "@gtkx/native";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { childEnv } from "./helpers/child-process.mjs";
import { drainAfterEachTest } from "./helpers/memory.mjs";

const OBSERVED_PREFIX = "OBSERVED ";
const CHILD_BUDGET_MS = 30_000;
const GLIB = "libglib-2.0.so.0";
const VOID = { kind: "void" };
const INT32 = { kind: "int32" };
const NESTING_LIMIT = 80;

drainAfterEachTest();

const fixture = (name) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

const childEnvironment = () => {
    const environment = childEnv();
    delete environment.G_DEBUG;

    return environment;
};

const runFixture = (name, args = []) =>
    new Promise((resolve) => {
        const child = spawn(process.execPath, [fixture(name), ...args], {
            env: childEnvironment(),
            stdio: ["ignore", "pipe", "pipe"],
        });

        const started = Date.now();
        const chunks = [];
        const budget = setTimeout(() => {
            child.kill("SIGKILL");
        }, CHILD_BUDGET_MS);

        child.stdout.on("data", (chunk) => {
            chunks.push(chunk);
        });

        child.stderr.on("data", (chunk) => {
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

const reportedLine = (output, prefix) =>
    output
        .split("\n")
        .find((line) => line.startsWith(prefix))
        ?.slice(prefix.length);

const observedMessage = (output) => reportedLine(output, OBSERVED_PREFIX);

test("benign native work never reaches the app as an error", async () => {
    const { code, output, signal } = await runFixture("error-channel.mjs", ["none", "observed"]);

    assert.equal(observedMessage(output), undefined);
    assert.match(output, /SURVIVED/);
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("a GLib critical reaches the app as an uncaught exception", async () => {
    const { code, output, signal } = await runFixture("error-channel.mjs", ["critical", "observed"]);

    const observed = observedMessage(output);
    assert.equal(typeof observed, "string");
    assert.ok(observed.length > 0);
    assert.doesNotMatch(output, /SURVIVED/);
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("a native panic reaches the app as an uncaught exception", async () => {
    const { code, output, signal } = await runFixture("error-channel.mjs", ["panic", "observed"]);

    const observed = observedMessage(output);
    assert.equal(typeof observed, "string");
    assert.ok(observed.length > 0);
    assert.doesNotMatch(output, /SURVIVED/);
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("an unhandled GLib critical stops the process", async () => {
    const { code, output } = await runFixture("error-channel.mjs", ["critical", "ignored"]);

    assert.notEqual(code, 0);
    assert.doesNotMatch(output, /SURVIVED/);
});

test("an unhandled native panic stops the process", async () => {
    const { code, output } = await runFixture("error-channel.mjs", ["panic", "ignored"]);

    assert.notEqual(code, 0);
    assert.doesNotMatch(output, /SURVIVED/);
});

test("quit tears the run loop down and lets the process exit", async () => {
    const { code, output, signal } = await runFixture("quit.mjs");

    assert.match(output, /OBJECT built/);
    assert.match(output, /QUIT/);
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("the process exits on its own when only unref'd GLib sources remain", async () => {
    const { code, elapsed, output, signal } = await runFixture("idle-exit.mjs");

    assert.match(output, /SOURCES/);
    assert.match(output, /EXITED/);
    assert.ok(elapsed < CHILD_BUDGET_MS / 2);
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("the addon drives real bindings inside a worker thread that finishes on its own", async () => {
    const { code, output, signal } = await runFixture("worker-host.mjs", ["graceful"]);

    assert.deepEqual(JSON.parse(reportedLine(output, "REPORT ")), {
        doubled: 42,
        string: "worker",
        bare: true,
    });
    assert.equal(reportedLine(output, "EXITED "), "0");
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("a worker thread that quits the addon can then be terminated", async () => {
    const { code, output, signal } = await runFixture("worker-host.mjs", ["terminate"]);

    assert.deepEqual(JSON.parse(reportedLine(output, "REPORT ")), {
        doubled: 42,
        string: "worker",
        bare: true,
    });
    assert.equal(reportedLine(output, "ACK "), "torn down");
    assert.equal(reportedLine(output, "TERMINATED "), "1");
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("a worker thread that never quits the addon can still be terminated", async () => {
    const { code, output, signal } = await runFixture("worker-host.mjs", ["kill"]);

    assert.deepEqual(JSON.parse(reportedLine(output, "REPORT ")), {
        doubled: 42,
        string: "worker",
        bare: true,
    });
    assert.equal(reportedLine(output, "TERMINATED "), "1");
    assert.equal(signal, null);
    assert.equal(code, 0);
});

test("a library or symbol that is not there fails the call it backs", () => {
    const missingLibrary = bind("libgtkx-not-a-real-library.so.0", "g_free", [], VOID);
    const missingSymbol = bind("libgobject-2.0.so.0", "g_object_not_a_real_symbol", [], VOID);

    assert.throws(() => resolveType("libgtkx-not-a-real-library.so.0", "gtk_widget_get_type"));
    assert.throws(() => call(missingLibrary, []));
    assert.throws(() => call(missingSymbol, []));
    assert.equal(resolveType("libgobject-2.0.so.0", "g_not_a_real_type_get_type"), 0n);
});

test("a malformed descriptor is refused when the call is bound", () => {
    let nested = INT32;

    for (let level = 0; level < NESTING_LIMIT; level += 1) {
        nested = { kind: "ref", innerDescriptor: nested };
    }

    const fixedArray = { kind: "array", itemDescriptor: INT32, arrayKind: "fixed", ownership: "borrowed" };
    const sizedArray = { kind: "array", itemDescriptor: INT32, arrayKind: "sized", ownership: "borrowed" };

    assert.throws(() => bind(GLIB, "g_free", [nested], VOID));
    assert.throws(() => bind(GLIB, "g_free", [{ kind: "string", ownership: "borrowed", length: -5 }], VOID));
    assert.throws(() => bind(GLIB, "g_free", [fixedArray], VOID));
    assert.throws(() => bind(GLIB, "g_free", [sizedArray], VOID));
    assert.throws(() => bind(GLIB, "g_free", [{ kind: "gtkx-not-a-kind" }], VOID));
});

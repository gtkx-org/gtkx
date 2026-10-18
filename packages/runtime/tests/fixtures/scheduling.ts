import assert from "node:assert/strict";
import { closeSync, openSync, readSync } from "node:fs";
import { isMainThread, parentPort, Worker } from "node:worker_threads";

const mode = isMainThread ? process.argv[2] : "workers";

const runtime = async () => {
    const { keepAlive } = await import("@gtkx/runtime/internal");
    const { quit, t } = await import("@gtkx/runtime");
    const callback = t.callback([t.buffer], t.boolean, {
        hasUserData: true,
        hasDestroy: true,
        userDataIndex: 0,
    });
    const idle = t.bind("libglib-2.0.so.0", "g_idle_add_full", [t.int32, callback], t.uint32);
    const timeout = t.bind("libglib-2.0.so.0", "g_timeout_add_full", [t.int32, t.uint32, callback], t.uint32);
    const remove = t.bind("libglib-2.0.so.0", "g_source_remove", [t.uint32], t.boolean);

    keepAlive(true);
    return { quit, t, idle, timeout, remove };
};

const nextTurn = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const waitUntil = async (predicate: () => boolean): Promise<void> => {
    const deadline = performance.now() + 2_000;
    while (!predicate()) {
        assert(performance.now() < deadline, "A GLib source failed to dispatch");
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
};

const completion = (): { promise: Promise<void>; resolve: () => void } => {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const watchdog = setTimeout(() => reject(new Error("A GLib source failed to wake the event loop")), 2_000);
    return { promise: promise.finally(() => clearTimeout(watchdog)), resolve };
};

const runBudget = async (): Promise<void> => {
    const { init } = await import("@gtkx/native");
    init(Number(process.argv[3]));
    const { idle, remove, quit } = await runtime();
    let calls = 0;
    const source = idle(0, () => {
        calls += 1;
        let now = performance.now();
        const end = now + 0.5;
        while (now < end) {
            now = performance.now();
        }
        return true;
    });
    await nextTurn();
    const firstTurnCalls = calls;
    let timers = 0;
    await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
            timers += 1;
            if (timers === 3) {
                clearInterval(timer);
                resolve();
            }
        }, 5);
    });
    assert(calls > firstTurnCalls);
    assert.equal(remove(source), true);
    quit();
    process.stdout.write(JSON.stringify({ firstTurnCalls, timers }));
};

const runTimeout = async (): Promise<void> => {
    const { idle, timeout, quit } = await runtime();
    const events: string[] = [];
    const done = completion();
    idle(0, () => {
        events.push("idle");
        return false;
    });
    timeout(0, 20, () => {
        events.push("timeout");
        done.resolve();
        return false;
    });
    await done.promise;
    quit();
    process.stdout.write(JSON.stringify(events));
};

const runQuit = async (): Promise<void> => {
    const { idle, quit } = await runtime();
    let calls = 0;
    idle(0, () => {
        calls += 1;
        quit();
        return false;
    });
    await waitUntil(() => calls === 1);
    await nextTurn();
    assert.equal(calls, 1);
    process.stdout.write("QUIT");
};

const runDescriptors = async (): Promise<void> => {
    const { t, remove, quit } = await runtime();
    const callback = t.callback([t.int32, t.uint32, t.buffer], t.boolean, {
        hasUserData: true,
        hasDestroy: true,
        userDataIndex: 2,
    });
    const watch = t.bind("libglib-2.0.so.0", "g_unix_fd_add_full", [t.int32, t.int32, t.uint32, callback], t.uint32);
    const pipe = t.bind("libc.so.6", "pipe", [t.buffer], t.int32);
    const duplicate = t.bind("libc.so.6", "dup2", [t.int32, t.int32], t.int32);
    const moveAbove = t.bind("libc.so.6", "fcntl", [t.int32, t.int32, t.int32], t.int32);
    const descriptors = new Int32Array(2);
    const createPipe = (): { input: number; output: number } => {
        assert.equal(pipe(descriptors), 0);
        const [input, output] = descriptors;
        assert(input !== undefined && output !== undefined);
        return { input, output };
    };
    const events: string[] = [];
    const produce = async (fd: number, done: Promise<void>): Promise<void> => {
        const source = `import { workerData } from "node:worker_threads";
            import { writeSync } from "node:fs";
            setInterval(() => {}, 1000);
            setTimeout(() => writeSync(workerData, Buffer.from("a")), 100);`;
        const producer = new Worker(
            new URL(`data:text/javascript,${encodeURIComponent(source)}`),
            { workerData: fd },
        );
        try {
            await done;
        } finally {
            await producer.terminate();
        }
    };
    let { input, output } = createPipe();
    const firstInput = input;
    const first = completion();
    const source = watch(0, input, 1, () => {
        readSync(input, Buffer.alloc(1), 0, 1, null);
        events.push("first");
        first.resolve();
        return true;
    });
    await nextTurn();
    await produce(output, first.promise);
    assert.equal(remove(source), true);
    closeSync(input);
    closeSync(output);
    ({ input, output } = createPipe());
    if (input !== firstInput) {
        const moved = moveAbove(output, 1030, firstInput + 1);
        assert(typeof moved === "number" && moved >= 0);
        closeSync(output);
        output = moved;
        assert.equal(duplicate(input, firstInput), firstInput);
        closeSync(input);
        input = firstInput;
    }
    assert.equal(input, firstInput);
    const reused = completion();
    watch(0, input, 1, () => {
        readSync(input, Buffer.alloc(1), 0, 1, null);
        events.push("reused");
        reused.resolve();
        return false;
    });
    await nextTurn();
    await produce(output, reused.promise);
    closeSync(input);
    closeSync(output);
    await nextTurn();
    const regularFile = openSync(import.meta.filename, "r");
    const unwatchable = completion();
    let unwatchableCalls = 0;
    const unwatchableSource = watch(0, regularFile, 1, () => {
        unwatchableCalls += 1;
        unwatchable.resolve();
        return true;
    });
    await unwatchable.promise;
    await nextTurn();
    assert(unwatchableCalls > 1);
    assert.equal(remove(unwatchableSource), true);
    events.push("unwatchable");
    closeSync(regularFile);
    quit();
    process.stdout.write(JSON.stringify(events));
};

const runWorkers = async (): Promise<void> => {
    if (!isMainThread) {
        try {
            const { timeout } = await runtime();
            timeout(0, 10, () => {
                parentPort?.postMessage("READY");
                return false;
            });
        } catch (error) {
            parentPort?.postMessage(error instanceof Error ? error.message : String(error));
        }
        return;
    }
    const start = async (): Promise<{ worker: Worker; message: unknown }> => {
        const worker = new Worker(new URL(import.meta.url));
        const message = await new Promise<unknown>((resolve, reject) => {
            worker.once("message", resolve);
            worker.once("error", reject);
            worker.once("exit", (code) => reject(new Error(`Worker exited before initialization: ${String(code)}`)));
        });
        return { worker, message };
    };
    const first = await start();
    assert.equal(first.message, "READY");
    const competing = await start();
    assert.equal(typeof competing.message, "string");
    assert.match(String(competing.message), /GTKX is already running on another thread/);
    await competing.worker.terminate();
    await first.worker.terminate();
    const replacement = await start();
    assert.equal(replacement.message, "READY");
    await replacement.worker.terminate();
    process.stdout.write("REACQUIRED");
};

if (mode === "budget") {
    await runBudget();
} else if (mode === "timeout") {
    await runTimeout();
} else if (mode === "quit") {
    await runQuit();
} else if (mode === "descriptors") {
    await runDescriptors();
} else if (mode === "workers") {
    await runWorkers();
} else if (mode === "invalid-budget") {
    const { init } = await import("@gtkx/native");
    for (const budget of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
        assert.throws(() => init(budget), /positive finite duration/);
    }
    const { quit } = await runtime();
    quit();
    process.stdout.write("REJECTED");
} else {
    throw new Error(`Unknown scheduler fixture mode: ${String(mode)}`);
}

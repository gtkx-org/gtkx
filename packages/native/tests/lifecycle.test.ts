import { bind, call, init, keepAlive, quit } from "@gtkx/native";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";

const duplicate = bind(GLIB, "g_strdup", [{ kind: "string", ownership: "borrowed" }], {
    kind: "string",
    ownership: "full",
});

const idleAdd = bind(
    GLIB,
    "g_idle_add_full",
    [
        { kind: "int32" },
        {
            kind: "callback",
            argDescriptors: [],
            returnDescriptor: { kind: "boolean" },
            hasDestroy: true,
            hasUserData: true,
            scope: "notified",
        },
    ],
    { kind: "uint32" },
);

const tick = async (): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, 50);
    });
};

const queueIdle = (onDispatch: () => void): void => {
    call(idleAdd, [
        0,
        () => {
            onDispatch();

            return false;
        },
    ]);
};

const didDispatchIdle = async (): Promise<boolean> => {
    let wasDispatched = false;

    queueIdle(() => {
        wasDispatched = true;
    });

    await tick();

    return wasDispatched;
};

test("quitting stops glib idle sources from dispatching", async () => {
    quit();
    const wasDispatched = await didDispatchIdle();
    init();

    expect(wasDispatched).toBe(false);
});

test("initializing after a teardown dispatches glib idle sources again", async () => {
    quit();
    init();

    await expect(didDispatchIdle()).resolves.toBe(true);
});

test("an idle source queued while torn down dispatches once init reinstalls the integration", async () => {
    quit();
    let wasDispatched = false;

    queueIdle(() => {
        wasDispatched = true;
    });

    await tick();
    const wasDispatchedWhileTornDown = wasDispatched;
    init();
    await tick();

    expect(wasDispatchedWhileTornDown).toBe(false);
    expect(wasDispatched).toBe(true);
});

test("initializing several times in a row leaves glib idle sources dispatching", async () => {
    quit();
    init();
    init();
    init();

    await expect(didDispatchIdle()).resolves.toBe(true);
});

test("initializing from inside a glib dispatch leaves the integration dispatching", async () => {
    init();
    let wasReinitialized = false;

    queueIdle(() => {
        init();
        wasReinitialized = true;
    });

    await tick();
    const wasDispatchedAfterwards = await didDispatchIdle();

    expect(wasReinitialized).toBe(true);
    expect(wasDispatchedAfterwards).toBe(true);
});

test("quitting twice in a row leaves the integration torn down and reinstallable", async () => {
    quit();
    quit();
    const wasDispatchedWhileTornDown = await didDispatchIdle();
    init();
    const wasDispatchedAfterInit = await didDispatchIdle();

    expect(wasDispatchedWhileTornDown).toBe(false);
    expect(wasDispatchedAfterInit).toBe(true);
});

test("quitting from inside a glib dispatch stops later idle sources from dispatching", async () => {
    init();
    let wasQuit = false;

    queueIdle(() => {
        quit();
        wasQuit = true;
    });

    await tick();
    const wasDispatchedAfterQuit = await didDispatchIdle();
    init();

    expect(wasQuit).toBe(true);
    expect(wasDispatchedAfterQuit).toBe(false);
});

test("a bound call still succeeds while the main loop integration is torn down", () => {
    quit();
    const duplicated = call(duplicate, ["torn down"]);
    init();

    expect(duplicated).toBe("torn down");
});

test("glib idle sources keep dispatching while the keep alive is on", async () => {
    init();
    keepAlive(true);
    const wasDispatched = await didDispatchIdle();
    keepAlive(false);

    expect(wasDispatched).toBe(true);
});

test("enabling and disabling the keep alive repeatedly leaves idle sources dispatching", async () => {
    init();
    keepAlive(true);
    keepAlive(true);
    keepAlive(false);
    keepAlive(false);

    await expect(didDispatchIdle()).resolves.toBe(true);
});

test("enabling the keep alive before a teardown leaves the integration reinstallable", async () => {
    init();
    keepAlive(true);
    quit();
    init();
    const wasDispatched = await didDispatchIdle();
    keepAlive(false);

    expect(wasDispatched).toBe(true);
});

test("toggling the keep alive while torn down leaves the integration reinstallable", async () => {
    quit();
    keepAlive(true);
    keepAlive(false);
    init();

    await expect(didDispatchIdle()).resolves.toBe(true);
});

test("toggling the keep alive from inside a glib dispatch leaves the integration dispatching", async () => {
    init();
    let wasToggled = false;

    queueIdle(() => {
        keepAlive(true);
        keepAlive(false);
        wasToggled = true;
    });

    await tick();
    const wasDispatchedAfterwards = await didDispatchIdle();

    expect(wasToggled).toBe(true);
    expect(wasDispatchedAfterwards).toBe(true);
});

test("toggling the keep alive without an argument throws", () => {
    expect(() => {
        (keepAlive as () => void)();
    }).toThrow();
});

test("toggling the keep alive with a non-boolean argument throws", () => {
    expect(() => {
        (keepAlive as (enable: unknown) => void)("on");
    }).toThrow();
});

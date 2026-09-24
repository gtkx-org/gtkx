import * as GLib from "@gtkx/gi/glib";
import { keepAlive } from "@gtkx/native";
import { quit, t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

const library = process.argv[2];
if (library === undefined) {
    throw new Error("The fixture library is required");
}

const array = t.ptrArray(t.object("full"), "full");
const schedule = t.bind(library, "gtkx_separate_schedule_owned", [
    t.uint32,
    t.callback([array, t.struct()], t.void, {
        scope: "notified", hasUserData: true, userDataIndex: 1, hasDestroy: true,
    }),
], t.uint32);
const cancel = t.bind(library, "gtkx_separate_cancel_idle", [t.uint32], t.void);
const releases = t.bind(library, "gtkx_separate_releases", [t.uint32], t.uint32);
const getValue = t.bind(library, "gtkx_separate_input_get", [t.uint32, t.object()], t.int32);
const sourceIds: number[] = [];
const seen: unknown[][] = [];
const state = { exceptions: 0, hasHealthyDispatch: false };
const onException = (): void => {
    state.exceptions += 1;
};
const waitFor = async (isReady: () => boolean): Promise<void> => {
    const end = Date.now() + 5000;
    while (!isReady()) {
        if (Date.now() >= end) {
            throw new Error("The native dispatch did not complete");
        }
        globalThis.gc?.();
        await setImmediate();
    }
};

process.on("uncaughtException", onException);
keepAlive(true);

try {
    const before = releases(1) as number;
    sourceIds.push(schedule(0, (values: unknown[]) => {
        seen.push(values.map((value) => getValue(1, value)));
        throw new Error("callback failure");
    }) as number);
    await waitFor(() => state.exceptions === 1 && (releases(1) as number) - before === 4);
    assert.deepEqual(seen, [[3, 7]]);
    assert.equal(state.exceptions, 1);
    sourceIds.push(GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
        state.hasHealthyDispatch = true;

        return GLib.SOURCE_REMOVE;
    }));
    await waitFor(() => state.hasHealthyDispatch);
    assert.equal(state.exceptions, 1);
    assert.equal((releases(1) as number) - before, 4);
} finally {
    for (const id of sourceIds) {
        cancel(id);
    }
    process.off("uncaughtException", onException);
    keepAlive(false);
    quit();
}

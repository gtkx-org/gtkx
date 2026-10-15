import { keepAlive } from "@gtkx/runtime/internal";
import { onExit, quit } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const registerCallbacks = (mode: string, record: (event: string) => void): void => {
    onExit(() => {
        record("first");

        if (mode === "reentrant") {
            quit();
            record("reentered");
        } else if (mode === "multiple-errors") {
            throw new Error("First cleanup failed");
        }
    });
    onExit(() => {
        record("second");

        if (mode === "reenabled-error") {
            keepAlive(false);
        }

        if (mode === "single-error" || mode === "multiple-errors" || mode === "reenabled-error") {
            throw new Error("Second cleanup failed");
        }
    });
    onExit(() => {
        record("third");
        if (mode === "reenabled-error") {
            keepAlive(true);
        }
    });
};

const run = (mode: string, artifact: string): void => {
    const events: string[] = [];
    const record = (event: string): void => {
        events.push(event);
        writeFileSync(artifact, JSON.stringify(events));
    };

    if (mode !== "empty") {
        registerCallbacks(mode, record);
    }

    keepAlive(true);

    if (mode === "single-error" || mode === "multiple-errors" || mode === "reenabled-error") {
        assert.throws(quit);
        record("thrown");
    } else {
        quit();
        record("returned");
    }

    quit();
    keepAlive(true);
    record("repeated");
};

const [mode, artifact] = process.argv.slice(2);

if (mode === undefined || artifact === undefined) {
    throw new Error("The cleanup fixture requires a mode and artifact path");
}

run(mode, artifact);

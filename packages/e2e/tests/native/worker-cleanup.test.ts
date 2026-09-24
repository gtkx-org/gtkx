import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";
import { fixtureLibrary } from "./helpers/fixture-library.js";

const library = fixtureLibrary("worker-cleanup", "gobject-2.0");

test.each(["complete", "cancel"])("an owning worker releases native owners after %s and quit", (mode) => {
    expect(() => {
        execFileSync(process.execPath, [
            ...fixtureArgs("worker-cleanup-host.ts", ["--expose-gc"]), library, mode,
        ], { env: childEnv(), stdio: "pipe", timeout: 30_000 });
    }).not.toThrow();
});

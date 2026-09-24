import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";
import { fixtureLibrary } from "./helpers/fixture-library.js";

const library = fixtureLibrary("separate-containers", "gobject-2.0");

test("async callback failure releases later owned arrays and permits healthy dispatch", () => {
    const result = spawnSync(process.execPath, [
        ...fixtureArgs("callback-exception-ownership-async.ts", ["--expose-gc"]), library,
    ], { env: childEnv(), stdio: "pipe", timeout: 15_000 });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
});

import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";

test.each(["complete", "cancel"])("an owning worker releases native owners after %s and quit", (mode) => {
    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-worker-cleanup-"));
    const library = join(temporary.path, "libgtkx-worker-cleanup.so");
    const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", "gobject-2.0"], {
        encoding: "utf8",
    }).trim().split(/\s+/);
    execFileSync(resolveExecutable("cc"), [
        "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror",
        fileURLToPath(new URL("fixtures/worker-cleanup.c", import.meta.url)), "-o", library, ...flags,
    ]);

    expect(() => {
        execFileSync(process.execPath, [
            ...fixtureArgs("worker-cleanup-host.ts", ["--expose-gc"]), library, mode,
        ], { env: childEnv(), stdio: "pipe", timeout: 30_000 });
    }).not.toThrow();
});

import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll } from "vitest";

const callAbiFixture = (): string => {
    const temporary = mkdtempSync(join(tmpdir(), "gtkx-call-abi-"));
    const library = join(temporary, "libgtkx-call-abi.so");

    beforeAll(() => {
        execFileSync(resolveExecutable("cc"), [
            "-shared",
            "-fPIC",
            "-Wall",
            "-Wextra",
            "-Werror",
            join(import.meta.dirname, "../fixtures/call-abi.c"),
            "-o",
            library,
        ]);
    });

    afterAll(() => {
        rmSync(temporary, { recursive: true, force: true });
    });

    return library;
};

export { callAbiFixture };

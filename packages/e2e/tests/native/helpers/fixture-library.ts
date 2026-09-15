import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll } from "vitest";

const fixtureLibrary = (name: string, pkg = "glib-2.0"): string => {
    const temporary = mkdtempSync(join(tmpdir(), `gtkx-${name}-`));
    const library = join(temporary, `libgtkx-${name}.so`);

    beforeAll(() => {
        const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", pkg], {
            encoding: "utf8",
        }).trim().split(/\s+/);
        execFileSync(resolveExecutable("cc"), [
            "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror",
            join(import.meta.dirname, "../fixtures", `${name}.c`), "-o", library, ...flags,
        ]);
    });

    afterAll(() => {
        rmSync(temporary, { recursive: true, force: true });
    });

    return library;
};

export { fixtureLibrary };

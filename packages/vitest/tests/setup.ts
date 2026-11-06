import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

/**
 * Each test file gets a private `TMPDIR`, so a concurrent reaper of stale `gtkx-xdg-*` directories (another file's
 * Vitest child, another package's run) cannot remove the displays these tests orphan on purpose before they check them.
 */
const runtimeRoot = mkdtempSync(join(tmpdir(), "gtkx-vitest-tests-"));
process.env.TMPDIR = runtimeRoot;

afterAll(() => {
    rmSync(runtimeRoot, { recursive: true, force: true });
});

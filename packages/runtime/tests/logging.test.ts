import { resolveExecutable } from "@gtkx/utils";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vitest";
import { collectOutput } from "./helpers/child-output.js";

const fixture = fileURLToPath(new URL("./fixtures/logging.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
const directory = mkdtempSync(join(tmpdir(), "gtkx-logging-"));
const library = join(directory, "libgtkx-logging.so");
execFileSync(resolveExecutable("gcc"), [
    "-shared",
    "-fPIC",
    "-Wall",
    "-Wextra",
    "-Werror",
    join(import.meta.dirname, "fixtures/logging.c"),
    "-o",
    library,
    ...execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", "glib-2.0"], { encoding: "utf8" })
        .trim()
        .split(/\s+/),
]);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("GLib criticals are logged without failing the call or ending the process", async () => {
    const child = spawn(process.execPath, ["--import", loader, fixture, library], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
        killSignal: "SIGKILL",
    });
    const read = collectOutput(child);
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
    });

    expect(exit).toEqual({ code: 0, signal: null });
    expect(read()).toContain("CALL RETURNED");
    expect(read()).toContain("STILL RUNNING");
});

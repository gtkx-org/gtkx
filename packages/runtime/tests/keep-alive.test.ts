import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/keep-alive.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

test.each([
    { mode: "held", output: "COMPLETED" },
    { mode: "released", output: "RELEASED" },
])("an $mode runtime exits with the expected work completed", async ({ mode, output }) => {
    const result = await run(process.execPath, ["--import", loader, fixture, mode], { timeout: 10_000 });
    expect(result.stdout.trim()).toBe(output);
});

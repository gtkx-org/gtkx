import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/keep-alive.ts", import.meta.url));
const loader = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;

test.each([
    { title: "holds the runtime for pending native work", mode: "held", output: "COMPLETED" },
    { title: "allows an idle runtime to exit", mode: "released", output: "RELEASED" },
    { title: "repeatedly enabling does not require repeated releases", mode: "repeated", output: "RELEASED" },
    { title: "can hold the runtime again after releasing it", mode: "toggled", output: "COMPLETED" },
    { title: "cannot hold the runtime after quit", mode: "after-quit", output: "RELEASED" },
])("$title", async ({ mode, output }) => {
    const result = await run(process.execPath, ["--import", loader, fixture, mode], { timeout: 10_000 });
    expect(result.stdout.trim()).toBe(output);
});
